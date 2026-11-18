// BrowseCurator - Background Service Worker

importScripts('rules/const/word-filter.js', 'rules/const/blocklist.js', 'rules/filter-rules.js');

// Initialize settings on installation or reload
chrome.runtime.onInstalled.addListener(async (details) => {
  const current = await chrome.storage.local.get(null);
  const defaults = BrowseCuratorRules.DEFAULT_SETTINGS;

  const merged = Object.assign({}, defaults, current);
  // Merge default blocklist with custom additions while avoiding duplicates
  const existingBlocklist = Array.isArray(current.customBlocklist) ? current.customBlocklist : [];
  const defaultBlocklist = Array.isArray(defaults.customBlocklist) ? defaults.customBlocklist : [];
  merged.customBlocklist = Array.from(new Set([...defaultBlocklist, ...existingBlocklist]));

  await chrome.storage.local.set(merged);
  console.log('BrowseCurator initialized with configuration:', merged);

  // If parent email is not yet configured, automatically open the setup page
  if (!current.parentEmail || !current.setupCompleted) {
    chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') });
  }
});

// Clean up expired temporary passes (e.g., passes older than 1 hour)
async function cleanExpiredPasses() {
  const data = await chrome.storage.local.get(['temporaryPasses']);
  const passes = data.temporaryPasses || {};
  const now = Date.now();
  let changed = false;

  for (const [domain, expiry] of Object.entries(passes)) {
    if (now > expiry) {
      delete passes[domain];
      changed = true;
    }
  }

  if (changed) {
    await chrome.storage.local.set({ temporaryPasses: passes });
  }
}

// Clean passes periodically
chrome.runtime.onStartup.addListener(cleanExpiredPasses);

// Message broker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'blockCurrentPage') {
    handleBlockPage(sender.tab, message);
    sendResponse({ status: 'redirecting' });
    return true;
  }

  if (message.action === 'verifyPin') {
    chrome.storage.local.get(['parentPin'], (data) => {
      const pin = data.parentPin || '1234';
      sendResponse({ valid: message.pin === pin });
    });
    return true;
  }

  if (message.action === 'grantTemporaryPass') {
    handleGrantPass(message.domain, message.durationMinutes || 60).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'addToAllowlist') {
    handleAddToAllowlist(message.domain).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function handleBlockPage(tab, message) {
  if (!tab || !tab.id) return;

  const storageData = await chrome.storage.local.get(['parentEmail']);
  const recipient = storageData.parentEmail || 'luca.culcean@gmail.com';

  // Send parent alert notification in background to email service
  notifyParentEmailService({
    recipientEmail: recipient,
    url: message.url || tab.url || 'Unknown page',
    reason: message.reason || 'Safety threshold reached',
    matches: (message.matched || []).join(', '),
    timestamp: new Date().toLocaleString('ro-RO')
  });

  // Redirect to blocked screen without revealing reasons/terms in URL
  const blockedUrl = chrome.runtime.getURL('blocked.html') +
    `?url=${encodeURIComponent(message.url || tab.url || '')}`;

  try {
    await chrome.tabs.update(tab.id, { url: blockedUrl });
  } catch (err) {
    console.error('Failed to redirect to block page:', err);
  }
}

async function notifyParentEmailService(payload) {
  try {
    const data = await chrome.storage.local.get(['serverEndpoint']);
    const endpoint = (data.serverEndpoint && data.serverEndpoint.trim()) || 'http://localhost:3001/api/notify';

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`BrowseCurator: Alert sent to server (${endpoint}) successfully.`);
  } catch (err) {
    // If the notification server is unreachable, log cleanly
    console.log('BrowseCurator: Alert server offline or unreachable, alert details:', payload);
  }
}

async function handleGrantPass(domain, durationMinutes) {
  const data = await chrome.storage.local.get(['temporaryPasses']);
  const passes = data.temporaryPasses || {};
  const expiresAt = Date.now() + (durationMinutes * 60 * 1000);
  passes[domain] = expiresAt;
  await chrome.storage.local.set({ temporaryPasses: passes });
}

async function handleAddToAllowlist(domain) {
  const data = await chrome.storage.local.get(['customAllowlist']);
  const allowlist = data.customAllowlist || [];
  if (!allowlist.includes(domain)) {
    allowlist.push(domain);
    await chrome.storage.local.set({ customAllowlist: allowlist });
  }
}
