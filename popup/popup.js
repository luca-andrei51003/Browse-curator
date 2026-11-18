// BrowseCurator - Popup Controller

(function () {
  'use strict';

  // Elements
  const masterToggle = document.getElementById('masterToggle');
  const statusBanner = document.getElementById('statusBanner');
  const statusText = document.getElementById('statusText');

  const pageShieldToggle = document.getElementById('pageShieldToggle');
  const imageShieldToggle = document.getElementById('imageShieldToggle');
  const textFilterToggle = document.getElementById('textFilterToggle');
  const sensButtons = document.querySelectorAll('.sens-btn');

  const allowListUl = document.getElementById('allowListUl');
  const blockListUl = document.getElementById('blockListUl');
  const newAllowInput = document.getElementById('newAllowInput');
  const newBlockInput = document.getElementById('newBlockInput');
  const addAllowBtn = document.getElementById('addAllowBtn');
  const addBlockBtn = document.getElementById('addBlockBtn');

  const currentPinInput = document.getElementById('currentPinInput');
  const newPinInput = document.getElementById('newPinInput');
  const savePinBtn = document.getElementById('savePinBtn');
  const pinStatusMsg = document.getElementById('pinStatusMsg');

  const parentEmailPopup = document.getElementById('parentEmailPopup');
  const saveEmailBtn = document.getElementById('saveEmailBtn');
  const emailStatusMsg = document.getElementById('emailStatusMsg');

  let state = {};

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Load storage state
  chrome.storage.local.get(null, (loaded) => {
    state = Object.assign({}, BrowseCuratorRules.DEFAULT_SETTINGS, loaded);
    renderState();
  });

  function renderState() {
    masterToggle.checked = !!state.enabled;
    updateStatusBanner(state.enabled);

    pageShieldToggle.checked = !!state.pageShieldEnabled;
    imageShieldToggle.checked = !!state.imageShieldEnabled;
    textFilterToggle.checked = !!state.textFilterEnabled;

    sensButtons.forEach(btn => {
      const sens = btn.getAttribute('data-sens');
      btn.classList.toggle('active', sens === state.sensitivity);
    });

    renderList(allowListUl, state.customAllowlist || [], 'allow');
    renderList(blockListUl, state.customBlocklist || [], 'block');

    if (parentEmailPopup) {
      parentEmailPopup.value = state.parentEmail || '';
    }
  }

  function updateStatusBanner(enabled) {
    if (enabled) {
      statusBanner.classList.remove('disabled');
      statusBanner.classList.add('active');
      statusText.textContent = 'Protection is Active';
    } else {
      statusBanner.classList.add('disabled');
      statusBanner.classList.remove('active');
      statusText.textContent = 'Protection is Paused';
    }
  }

  // Master switch
  masterToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    state.enabled = enabled;
    updateStatusBanner(enabled);
    chrome.storage.local.set({ enabled });
  });

  // Sub-shields toggles
  pageShieldToggle.addEventListener('change', (e) => {
    state.pageShieldEnabled = e.target.checked;
    chrome.storage.local.set({ pageShieldEnabled: state.pageShieldEnabled });
  });

  imageShieldToggle.addEventListener('change', (e) => {
    state.imageShieldEnabled = e.target.checked;
    chrome.storage.local.set({ imageShieldEnabled: state.imageShieldEnabled });
  });

  textFilterToggle.addEventListener('change', (e) => {
    state.textFilterEnabled = e.target.checked;
    chrome.storage.local.set({ textFilterEnabled: state.textFilterEnabled });
  });

  // Sensitivity selection
  sensButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const sens = btn.getAttribute('data-sens');
      state.sensitivity = sens;
      sensButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chrome.storage.local.set({ sensitivity: sens });
    });
  });

  // Lists management
  function renderList(ulElement, items, type) {
    ulElement.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'domain-item';
      empty.style.color = '#94a3b8';
      empty.textContent = 'No domains added yet.';
      ulElement.appendChild(empty);
      return;
    }

    items.forEach((domain, idx) => {
      const li = document.createElement('li');
      li.className = 'domain-item';

      const span = document.createElement('span');
      span.textContent = domain;

      const delBtn = document.createElement('button');
      delBtn.className = 'domain-delete-btn';
      delBtn.innerHTML = '&times;';
      delBtn.title = 'Remove';
      delBtn.addEventListener('click', () => {
        if (type === 'allow') {
          state.customAllowlist.splice(idx, 1);
          chrome.storage.local.set({ customAllowlist: state.customAllowlist });
          renderList(allowListUl, state.customAllowlist, 'allow');
        } else {
          state.customBlocklist.splice(idx, 1);
          chrome.storage.local.set({ customBlocklist: state.customBlocklist });
          renderList(blockListUl, state.customBlocklist, 'block');
        }
      });

      li.appendChild(span);
      li.appendChild(delBtn);
      ulElement.appendChild(li);
    });
  }

  function cleanDomainInput(val) {
    let clean = val.trim().toLowerCase();
    try {
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        clean = new URL(clean).hostname;
      }
    } catch (e) {}
    return clean.replace(/^\/+|\/+$/g, '');
  }

  addAllowBtn.addEventListener('click', () => {
    const val = cleanDomainInput(newAllowInput.value);
    if (!val) return;
    state.customAllowlist = state.customAllowlist || [];
    if (!state.customAllowlist.includes(val)) {
      state.customAllowlist.push(val);
      chrome.storage.local.set({ customAllowlist: state.customAllowlist });
      renderList(allowListUl, state.customAllowlist, 'allow');
    }
    newAllowInput.value = '';
  });

  addBlockBtn.addEventListener('click', () => {
    const val = cleanDomainInput(newBlockInput.value);
    if (!val) return;
    state.customBlocklist = state.customBlocklist || [];
    if (!state.customBlocklist.includes(val)) {
      state.customBlocklist.push(val);
      chrome.storage.local.set({ customBlocklist: state.customBlocklist });
      renderList(blockListUl, state.customBlocklist, 'block');
    }
    newBlockInput.value = '';
  });

  // Email Management
  if (saveEmailBtn) {
    saveEmailBtn.addEventListener('click', () => {
      const email = parentEmailPopup.value.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      emailStatusMsg.className = 'status-msg';

      if (!emailRegex.test(email)) {
        emailStatusMsg.classList.add('error');
        emailStatusMsg.textContent = 'Adresă de email invalidă.';
        return;
      }

      state.parentEmail = email;
      chrome.storage.local.set({ parentEmail: email, setupCompleted: true }, () => {
        emailStatusMsg.classList.add('success');
        emailStatusMsg.textContent = 'Email salvat cu succes!';
        setTimeout(() => {
          emailStatusMsg.className = 'status-msg hidden';
        }, 3000);
      });
    });
  }

  // PIN Management
  savePinBtn.addEventListener('click', () => {
    const currentEntered = currentPinInput.value.trim();
    const newPin = newPinInput.value.trim();
    pinStatusMsg.className = 'status-msg';

    if (currentEntered !== state.parentPin) {
      pinStatusMsg.classList.add('error');
      pinStatusMsg.textContent = 'Current PIN is incorrect.';
      return;
    }

    if (newPin.length < 4) {
      pinStatusMsg.classList.add('error');
      pinStatusMsg.textContent = 'New PIN must be at least 4 digits.';
      return;
    }

    state.parentPin = newPin;
    chrome.storage.local.set({ parentPin: newPin }, () => {
      pinStatusMsg.classList.add('success');
      pinStatusMsg.textContent = 'PIN updated successfully!';
      currentPinInput.value = '';
      newPinInput.value = '';
      setTimeout(() => {
        pinStatusMsg.className = 'status-msg hidden';
      }, 3000);
    });
  });
})();
