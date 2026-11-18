// BrowseCurator - Initial Setup Controller

(function () {
  'use strict';

  const form = document.getElementById('setupForm');
  const emailInput = document.getElementById('parentEmailInput');
  const pinInput = document.getElementById('pinInput');
  const errorMsg = document.getElementById('errorMsg');
  const successMsg = document.getElementById('successMsg');
  const saveBtn = document.getElementById('saveBtn');

  // Load existing values if already present
  chrome.storage.local.get(['parentEmail', 'parentPin'], (data) => {
    if (data.parentEmail) {
      emailInput.value = data.parentEmail;
    }
    if (data.parentPin) {
      pinInput.value = data.parentPin;
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorMsg.classList.add('hidden');
    successMsg.classList.add('hidden');

    const email = emailInput.value.trim().toLowerCase();
    const pin = pinInput.value.trim();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('Vă rugăm să introduceți o adresă de email validă.');
      emailInput.focus();
      return;
    }

    // Validate PIN
    if (pin.length < 4) {
      showError('Codul PIN trebuie să conțină cel puțin 4 caractere.');
      pinInput.focus();
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Se salvează...';

    chrome.storage.local.set({
      parentEmail: email,
      parentPin: pin,
      setupCompleted: true
    }, () => {
      successMsg.classList.remove('hidden');
      saveBtn.textContent = 'Salvat!';

      // Forward to test page or close after short delay
      setTimeout(() => {
        window.location.href = chrome.runtime.getURL('test/test-page.html');
      }, 1200);
    });
  });

  function showError(text) {
    errorMsg.textContent = text;
    errorMsg.classList.remove('hidden');
  }
})();
