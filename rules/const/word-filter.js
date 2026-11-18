// BrowseCurator - Word Filter Constants
// Categorized word lists for content and image filtering (English & Romanian)

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BrowseCuratorWords = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Words or phrases that trigger an immediate page block upon match
  const SEVERE_TERMS = [
    // --- English Terms ---
    // Explicit / illicit pornographic terms
    'porn', 'porno', 'pornography', 'xxx', 'hentai', 'hardcore sex',
    'erotic video', 'nsfw video', 'camgirls', 'chaturbate', 'redtube',
    'xvideos', 'xnxx', 'youporn', 'stripchat', 'adult webcam',
    'onlyfans leaks', 'erotic stories', 'blowjob', 'gangbang', 'threesome sex',
    // Extreme violence / illegal harm
    'child exploitation', 'child porn', 'snuff video', 'suicide tutorial', 'suicide method',
    'how to make a bomb',
    'milf',
    'nigger', 'faggot',
    // Sensual / mature keywords
    'naked pictures', 'sex tape', 'erotic photo',
    'topless', 'horny', 'orgasm', 'masturbation', 'escort service',
    'penis', 'vagina', 'dildo', 'boobs', 'tits',

    // --- Romanian Equivalents (cu & fără diacritice) ---
    // Conținut explicit / pornografic
    'pornografie', 'sex dur', 'video erotic', 'fete la camera', 'fete la cameră',
    'camiste', 'videochat', 'camera web adulti', 'cameră web adulți',
    'povesti erotice', 'povești erotice', 'scurgeri onlyfans',
    'felatie', 'felație', 'muie', 'sex in grup', 'sex în grup', 'sex in trei', 'sex în trei',
    // Violență extremă / ilegalități
    'exploatare copii', 'exploatarea minorilor', 'pornografie infantila', 'pornografie infantilă',
    'video snuff', 'tutorial sinucidere', 'metoda sinucidere', 'metodă sinucidere',
    'cum sa faci o bomba', 'cum să faci o bombă',
    // Injurii severe / termeni vulgari
    'fute', 'futere', 'futut', 'futu-te', 'fute-te', 'futu-ti', 'futu-ți',
    'pula', 'pulă', 'pizda', 'pizdă',
    'tarfa', 'târfă', 'tarfe', 'târfe',
    // Termeni maturi / senzuali
    'poze goale', 'poze nud', 'video porno', 'fara haine', 'fără haine',
    'banda sexuala', 'bandă sexuală', 'filmare porno', 'excitat', 'excitata', 'excitată',
    'masturbare', 'masturbat',
    'servicii escorte', 'servicii de escorta', 'servicii de escortă',
    'vagin'
  ];

  // Moderate terms: profanity, vulgarity, hate speech, vulgar slurs, illicit imagery indicators
  const MODERATE_TERMS = [
    // --- English Terms ---

    // --- Romanian Equivalents (cu & fără diacritice) ---
  ];

  // Image alt/src suspicious keywords
  const IMAGE_FLAG_TERMS = [
    // English
    'porn', 'xxx', 'nude', 'naked', 'nsfw', 'sex', 'boobs', 'tits',
    'penis', 'vagina', 'anal', 'hentai', 'erotic', 'lingerie model', 'lingerie',

    // Romanian
    'porno', 'nud', 'gol', 'goala', 'goală', 'goi', 'tate', 'țâțe',
    'vagin', 'lenjerie intima', 'lenjerie intimă'
  ];

  return {
    SEVERE_TERMS,
    MODERATE_TERMS,
    IMAGE_FLAG_TERMS
  };
});
