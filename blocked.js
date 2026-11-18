// BrowseCurator - Blocked Page Controller

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const targetUrl = params.get('url') || 'Unknown page';
  const reason = params.get('reason') || 'Safety criteria exceeded';
  const matches = params.get('matches') || '';

  // Extract hostname
  let targetDomain = '';
  try {
    targetDomain = new URL(targetUrl).hostname;
  } catch (e) {
    targetDomain = targetUrl;
  }

  // Action buttons
  document.getElementById('goBackBtn').addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'https://www.google.com';
    }
  });

  document.getElementById('safeHomeBtn').addEventListener('click', () => {
    window.location.href = 'chrome://newtab/';
  });

  // Parent form toggle
  const toggleParentBtn = document.getElementById('toggleParentBtn');
  const parentForm = document.getElementById('parentForm');
  toggleParentBtn.addEventListener('click', () => {
    const isHidden = parentForm.classList.contains('hidden');
    parentForm.classList.toggle('hidden', !isHidden);
    if (isHidden) {
      document.getElementById('parentPinInput').focus();
    }
  });

  // Unlock logic
  const unlockBtn = document.getElementById('unlockBtn');
  const pinInput = document.getElementById('parentPinInput');
  const pinError = document.getElementById('pinError');

  unlockBtn.addEventListener('click', attemptUnlock);
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      attemptUnlock();
    }
  });

  function attemptUnlock() {
    const enteredPin = pinInput.value.trim();
    pinError.classList.add('hidden');

    if (!enteredPin) {
      pinError.textContent = 'Please enter your PIN.';
      pinError.classList.remove('hidden');
      return;
    }

    chrome.runtime.sendMessage({ action: 'verifyPin', pin: enteredPin }, (response) => {
      if (chrome.runtime.lastError || !response || !response.valid) {
        pinError.textContent = 'Incorrect parent PIN.';
        pinError.classList.remove('hidden');
        pinInput.value = '';
        pinInput.focus();
        return;
      }

      // Valid PIN
      const unlockType = document.querySelector('input[name="unlockType"]:checked').value;

      if (unlockType === 'permanent') {
        chrome.runtime.sendMessage({ action: 'addToAllowlist', domain: targetDomain }, () => {
          proceedToTarget();
        });
      } else {
        chrome.runtime.sendMessage({ action: 'grantTemporaryPass', domain: targetDomain, durationMinutes: 60 }, () => {
          proceedToTarget();
        });
      }
    });
  }

  function proceedToTarget() {
    if (targetUrl && targetUrl !== 'Unknown page') {
      window.location.href = targetUrl;
    } else {
      window.location.href = 'https://www.google.com';
    }
  }
})();
