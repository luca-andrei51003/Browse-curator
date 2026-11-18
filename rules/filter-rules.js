// BrowseCurator - Safety Rule Sets & Heuristics
// Organized into Severe (immediate block) and Moderate (cumulative score)

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./const/word-filter'),
      require('./const/blocklist')
    );
  } else {
    root.BrowseCuratorRules = factory(
      root.BrowseCuratorWords,
      root.BrowseCuratorBlocklist
    );
  }
})(typeof self !== 'undefined' ? self : this, function (wordsModule, blocklistModule) {
  'use strict';

  // Reference word constants from rules/const/word-filter.js
  const words = wordsModule || (typeof BrowseCuratorWords !== 'undefined' ? BrowseCuratorWords : {
    SEVERE_TERMS: [],
    MODERATE_TERMS: [],
    IMAGE_FLAG_TERMS: []
  });

  // Reference blocklist from rules/const/blocklist.js
  const blocklist = blocklistModule || (typeof BrowseCuratorBlocklist !== 'undefined' ? BrowseCuratorBlocklist : {
    DEFAULT_BLOCKLIST: []
  });

  const SEVERE_TERMS = words.SEVERE_TERMS || [];
  const MODERATE_TERMS = words.MODERATE_TERMS || [];
  const IMAGE_FLAG_TERMS = words.IMAGE_FLAG_TERMS || [];
  const DEFAULT_BLOCKLIST = blocklist.DEFAULT_BLOCKLIST || [];

  // Default Settings
  const DEFAULT_SETTINGS = {
    enabled: true,
    parentPin: '1234', // Default parent PIN (can be changed in settings)
    sensitivity: 'medium', // 'low' (threshold: 10), 'medium' (threshold: 5), 'high' (threshold: 2)
    pageShieldEnabled: true,     // Redirects page if threshold or severe match is found
    textFilterEnabled: true,     // Masks bad words in place on allowed pages
    imageShieldEnabled: true,    // Blurs suspicious images
    customBlocklist: [...DEFAULT_BLOCKLIST], // Domains or URLs always blocked
    customAllowlist: [],         // Domains always allowed
    temporaryPasses: {}          // e.g. { "example.com": timestamp }
  };

  const SENSITIVITY_THRESHOLDS = {
    low: 10,
    medium: 5,
    high: 2
  };

  /**
   * Helper to compile regex patterns safely
   */
  function buildRegexList(list) {
    return (list || []).map(w => {
      // Escape regex chars
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match whole word or exact token where applicable
      return {
        word: w,
        regex: new RegExp(`\\b${escaped}\\b`, 'i')
      };
    });
  }

  const severePatterns = buildRegexList(SEVERE_TERMS);
  const moderatePatterns = buildRegexList(MODERATE_TERMS);

  /**
   * Evaluate text content and return safety report
   */
  function inspectText(text) {
    if (!text || typeof text !== 'string') {
      return { safe: true, severeFound: false, score: 0, matchedWords: [] };
    }

    const cleanText = text.toLowerCase();
    const matches = [];

    // Check severe terms first
    for (const item of severePatterns) {
      if (item.regex.test(cleanText)) {
        matches.push({ term: item.word, severity: 'severe' });
      }
    }

    if (matches.length > 0) {
      return {
        safe: false,
        severeFound: true,
        score: 999,
        matchedWords: matches.map(m => m.term)
      };
    }

    // Check moderate terms
    let score = 0;
    for (const item of moderatePatterns) {
      const occurrences = (cleanText.match(new RegExp(item.regex, 'gi')) || []).length;
      if (occurrences > 0) {
        score += occurrences;
        matches.push({ term: item.word, severity: 'moderate', count: occurrences });
      }
    }

    return {
      safe: score === 0,
      severeFound: false,
      score: score,
      matchedWords: matches.map(m => m.term)
    };
  }

  /**
   * Check if an image URL or alt text contains suspicious terms
   */
  function inspectImageAttrs(src = '', alt = '', title = '') {
    const combined = `${src} ${alt} ${title}`.toLowerCase();
    for (const term of IMAGE_FLAG_TERMS) {
      const rx = new RegExp(`[\\b_\\-/]${term}[\\b_\\-/]`, 'i');
      if (rx.test(combined) || combined.includes(term)) {
        return { flagged: true, term };
      }
    }
    return { flagged: false };
  }

  /**
   * Mask offensive terms in a string
   */
  function maskText(rawString) {
    if (!rawString) return rawString;
    let filtered = rawString;
    [...severePatterns, ...moderatePatterns].forEach(item => {
      filtered = filtered.replace(new RegExp(item.regex, 'gi'), (match) => {
        return match[0] + '*'.repeat(Math.max(1, match.length - 2)) + (match.length > 1 ? match[match.length - 1] : '*');
      });
    });
    return filtered;
  }

  return {
    SEVERE_TERMS,
    MODERATE_TERMS,
    IMAGE_FLAG_TERMS,
    DEFAULT_BLOCKLIST,
    DEFAULT_SETTINGS,
    SENSITIVITY_THRESHOLDS,
    inspectText,
    inspectImageAttrs,
    maskText
  };
});
