// BrowseCurator - Content Script
// Inspects live page content, shields illicit imagery, masks bad language, and triggers page block

(function () {
  'use strict';

  // Prevent running in iframes or restricted protocols if desired,
  // or run only in top window for full-page blocks
  const isTopWindow = window.self === window.top;
  const currentUrl = window.location.href;
  const currentHostname = window.location.hostname.toLowerCase();

  // Internal extension or special pages to skip
  if (
    currentUrl.startsWith('chrome-extension://') ||
    currentUrl.startsWith('chrome://') ||
    currentUrl.startsWith('edge://') ||
    currentUrl.startsWith('about:')
  ) {
    return;
  }

  // Tag root for page diagnostic check & log status
  if (document.documentElement) {
    document.documentElement.dataset.browseCuratorActive = 'true';
  }
  console.log('🛡️ BrowseCurator Content Script loaded on:', currentUrl);

  let settings = null;
  let isBlocked = false;
  let accumulatedViolations = [];
  let pageScore = 0;

  // Load settings from storage
  chrome.storage.local.get(null, (loaded) => {
    settings = Object.assign({}, BrowseCuratorRules.DEFAULT_SETTINGS, loaded);
    if (!settings.enabled) {
      console.log('BrowseCurator: Protection is paused in settings.');
      return;
    }

    initShield();
  });

  function initShield() {
    // 1. Check custom blocklist (ensure hostname is valid before checking)
    if (currentHostname && settings.customBlocklist && settings.customBlocklist.some(d => d && currentHostname.includes(d.toLowerCase()))) {
      triggerBlock('Website is on your family blocklist', ['Blocked domain']);
      return;
    }

    // 2. Check custom allowlist
    if (currentHostname && settings.customAllowlist && settings.customAllowlist.some(d => d && currentHostname.includes(d.toLowerCase()))) {
      console.log('BrowseCurator: Site is in family allowlist. Protection bypassed.');
      return;
    }

    // 3. Check temporary pass
    if (currentHostname && settings.temporaryPasses && settings.temporaryPasses[currentHostname]) {
      const expiry = settings.temporaryPasses[currentHostname];
      if (Date.now() < expiry) {
        console.log('BrowseCurator: Active temporary pass for domain.');
        return;
      }
    }

    // 4. Inspect current URL
    const urlInspection = BrowseCuratorRules.inspectText(currentUrl);
    if (urlInspection.severeFound) {
      triggerBlock('Severe inappropriate terms detected in address', urlInspection.matchedWords);
      return;
    }

    // 5. Begin content inspection
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onDomReady);
    } else {
      onDomReady();
    }

    // Fallback: run scan again on window load in case images or fonts render late
    window.addEventListener('load', () => {
      if (!isBlocked && document.body) {
        scanTextInNode(document.body);
        if (settings.imageShieldEnabled) {
          scanImagesInNode(document.body);
        }
      }
    });
  }

  function onDomReady() {
    // Inspect Title and Meta Tags
    scanHeadMeta();
    if (isBlocked) return;

    // Initial Body Scan
    if (document.body) {
      scanTextInNode(document.body);
      if (isBlocked) return;

      if (settings.imageShieldEnabled) {
        scanImagesInNode(document.body);
      }
    }

    // Observe dynamic changes
    setupObserver();
  }

  function scanHeadMeta() {
    const title = document.title || '';
    let metaText = '';

    const metas = document.querySelectorAll('meta[name="keywords"], meta[name="description"]');
    metas.forEach(m => {
      metaText += ' ' + (m.getAttribute('content') || '');
    });

    const report = BrowseCuratorRules.inspectText(title + ' ' + metaText);
    if (report.severeFound) {
      triggerBlock('Severe illicit content detected in page title/metadata', report.matchedWords);
      return;
    }

    recordScore(report.score, report.matchedWords);
  }

  function scanTextInNode(root) {
    if (isBlocked) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const tag = node.parentElement ? node.parentElement.tagName.toLowerCase() : '';
          if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.nodeValue && node.nodeValue.trim().length > 1) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    const nodesToProcess = [];
    let currentNode;
    while ((currentNode = walker.nextNode())) {
      nodesToProcess.push(currentNode);
    }

    for (const node of nodesToProcess) {
      if (isBlocked) return;
      const val = node.nodeValue;
      const report = BrowseCuratorRules.inspectText(val);

      if (report.severeFound) {
        triggerBlock('Illicit imagery or explicit text detected', report.matchedWords);
        return;
      }

      if (report.score > 0) {
        recordScore(report.score, report.matchedWords);
        if (isBlocked) return;

        // Mask text in-place if text filter enabled
        if (settings.textFilterEnabled) {
          node.nodeValue = BrowseCuratorRules.maskText(val);
        }
      }
    }
  }

  function scanImagesInNode(root) {
    const images = root.tagName && root.tagName.toLowerCase() === 'img' ? [root] : root.querySelectorAll('img');

    images.forEach(img => {
      if (img.dataset.browseCuratorChecked) return;
      img.dataset.browseCuratorChecked = 'true';

      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      const title = img.getAttribute('title') || '';

      const check = BrowseCuratorRules.inspectImageAttrs(src, alt, title);
      if (check.flagged) {
        applyImageShield(img, check.term);
        recordScore(2, [`image: ${check.term}`]);
      }
    });
  }

  function applyImageShield(img, reason) {
    img.classList.add('browse-curator-blurred-img');

    // Add gentle reveal hint
    const parent = img.parentElement;
    if (parent && !img.dataset.badgeAdded) {
      img.dataset.badgeAdded = 'true';

      const badge = document.createElement('div');
      badge.className = 'browse-curator-badge-overlay';
      badge.innerHTML = `<span>🛡️ Content Shielded</span>`;
      badge.title = `Shielded reason: ${reason}. Click to reveal.`;

      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const pin = prompt('Parent PIN required to view this image:');
        if (pin) {
          chrome.runtime.sendMessage({ action: 'verifyPin', pin }, (res) => {
            if (res && res.valid) {
              img.classList.remove('browse-curator-blurred-img');
              badge.remove();
            } else {
              alert('Incorrect PIN.');
            }
          });
        }
      });

      // Wrap or insert badge
      if (window.getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      parent.appendChild(badge);
    }
  }

  function recordScore(points, terms) {
    if (points <= 0) return;
    pageScore += points;
    accumulatedViolations.push(...terms);

    // On the test sandbox page, allow inspecting masked text & blurred images
    // without automatically redirecting before the user clicks Section 3 buttons
    if (currentUrl.includes('test-page.html')) {
      return;
    }

    const threshold = BrowseCuratorRules.SENSITIVITY_THRESHOLDS[settings.sensitivity] || 5;

    if (settings.pageShieldEnabled && pageScore >= threshold) {
      triggerBlock('Multiple inappropriate terms or images detected', accumulatedViolations);
    }
  }

  function triggerBlock(reason, matched) {
    if (isBlocked) return;
    isBlocked = true;

    // If top window, redirect to block page
    if (isTopWindow) {
      chrome.runtime.sendMessage({
        action: 'blockCurrentPage',
        url: currentUrl,
        reason: reason,
        matched: Array.from(new Set(matched))
      });
    } else {
      // For subframes, simply blank them out
      document.body.innerHTML = `
        <div style="padding: 20px; font-family: sans-serif; text-align: center; color: #64748b;">
          🛡️ Embedded content shielded by BrowseCurator
        </div>
      `;
    }
  }

  function setupObserver() {
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
      if (isBlocked) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        for (const m of mutations) {
          if (m.type === 'childList') {
            m.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                scanTextInNode(node);
                if (settings.imageShieldEnabled) {
                  scanImagesInNode(node);
                }
              }
            });
          }
        }
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();
