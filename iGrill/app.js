/**
 * Restaurant Employee Clock-In & Attendance Web App
 * Hosted on GitHub Pages (100% Client-Side)
 * Google Identity (Gmail Verification) + Google Apps Script Webhook (Google Sheets)
 */

(function () {
  'use strict';

  // --- LOCAL STORAGE KEYS ---
  const STORAGE_KEYS = {
    SETTINGS: 'clockin_settings',
    ACTIVE_SHIFT: 'clockin_active_shift',
    HISTORY: 'clockin_history'
  };

  // Base configuration loaded from config.js
  const fileConfig = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG : {};

  // Default Settings merging config.js and localStorage
  const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
  let settings = {
    restaurantName: savedSettings.restaurantName || fileConfig.restaurantName || 'Bella Bistro & Bar',
    restaurantLogo: savedSettings.restaurantLogo || fileConfig.restaurantLogo || '',
    clientId: savedSettings.clientId || fileConfig.googleClientId || '',
    scriptUrl: savedSettings.scriptUrl || fileConfig.googleScriptUrl || ''
  };

  // Runtime State
  let activeShift = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFT) || 'null');
  let tokenClient = null;
  let shiftTimerInterval = null;

  // DOM Elements
  const el = {
    // Brand
    restaurantNameDisplay: document.getElementById('restaurant-name-display'),
    brandLogoSvg: document.getElementById('brand-logo-svg'),
    brandLogoImg: document.getElementById('brand-logo-img'),
    
    // Live Clock & Date
    liveClock: document.getElementById('live-clock'),
    liveDate: document.getElementById('live-date'),
    locationPill: document.getElementById('location-pill'),
    locationPillText: document.getElementById('location-pill-text'),

    // Screens
    screenClockIn: document.getElementById('screen-clockin'),
    screenActiveShift: document.getElementById('screen-active-shift'),

    // Screen 1: Clock In
    btnClockInTrigger: document.getElementById('btn-clockin-trigger'),
    googleSetupWarning: document.getElementById('google-setup-warning'),
    btnQuickSetup: document.getElementById('btn-quick-setup'),

    // Screen 2: Active Shift
    userName: document.getElementById('active-user-name'),
    userEmail: document.getElementById('active-user-email'),
    userAvatarInitials: document.getElementById('user-avatar-initials'),
    userAvatarImg: document.getElementById('user-avatar-img'),
    shiftClockInTime: document.getElementById('shift-clockin-time'),
    shiftDurationTimer: document.getElementById('shift-duration-timer'),
    shiftCoords: document.getElementById('shift-coords'),
    shiftAccuracy: document.getElementById('shift-accuracy'),
    shiftMapsLink: document.getElementById('shift-maps-link'),
    syncStatusBadge: document.getElementById('sync-status-badge'),
    syncStatusText: document.getElementById('sync-status-text'),
    btnClockOutTrigger: document.getElementById('btn-clockout-trigger'),

    // Modals
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingTitle: document.getElementById('loading-title'),
    loadingSubtitle: document.getElementById('loading-subtitle'),

    farewellModal: document.getElementById('farewell-modal'),
    farewellMessage: document.getElementById('farewell-message'),
    btnCloseFarewell: document.getElementById('btn-close-farewell'),

    settingsModal: document.getElementById('settings-modal'),
    btnOpenSettings: document.getElementById('btn-open-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnCancelSettings: document.getElementById('btn-cancel-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    inputRestaurantName: document.getElementById('input-restaurant-name'),
    inputRestaurantLogo: document.getElementById('input-restaurant-logo'),
    inputClientId: document.getElementById('input-client-id'),
    inputScriptUrl: document.getElementById('input-sheet-id'), // re-used input for script URL

    historyModal: document.getElementById('history-modal'),
    btnOpenHistory: document.getElementById('btn-open-history'),
    btnCloseHistory: document.getElementById('btn-close-history'),
    btnCloseHistoryBottom: document.getElementById('btn-close-history-bottom'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    historyListContainer: document.getElementById('history-list-container'),
  };

  // --- INITIALIZATION ---
  function init() {
    applyBrandSettings();
    startLiveClock();
    checkLocationCapability();
    updateSetupWarningVisibility();
    initGoogleAuth();
    bindEvents();

    // Check if there is already an active shift session
    if (activeShift && activeShift.status === 'Clocked In') {
      showActiveShiftScreen(activeShift);
    } else {
      showClockInScreen();
    }
  }

  // --- BRAND & CONFIG DISPLAY ---
  function applyBrandSettings() {
    el.restaurantNameDisplay.textContent = settings.restaurantName || 'Bella Bistro & Bar';
    document.title = (settings.restaurantName || 'Restaurant') + ' - Staff Clock-In';

    if (settings.restaurantLogo && settings.restaurantLogo.trim().length > 0) {
      el.brandLogoSvg.classList.add('hidden');
      el.brandLogoImg.src = settings.restaurantLogo;
      el.brandLogoImg.classList.remove('hidden');
    } else {
      el.brandLogoImg.classList.add('hidden');
      el.brandLogoSvg.classList.remove('hidden');
    }
  }

  function updateSetupWarningVisibility() {
    if (!settings.clientId || settings.clientId.trim().length === 0) {
      if (el.googleSetupWarning) el.googleSetupWarning.classList.remove('hidden');
    } else {
      if (el.googleSetupWarning) el.googleSetupWarning.classList.add('hidden');
    }
  }

  // --- LIVE CLOCK & DATE ---
  function startLiveClock() {
    function update() {
      const now = new Date();
      el.liveClock.textContent = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      el.liveDate.textContent = now.toLocaleDateString([], {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    update();
    setInterval(update, 1000);
  }

  // --- GEOLOCATION CAPTURE ---
  function checkLocationCapability() {
    if ('geolocation' in navigator) {
      el.locationPillText.textContent = 'GPS Location Ready';
      el.locationPill.className = 'mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100/80 text-emerald-800 border border-emerald-200';
    } else {
      el.locationPillText.textContent = 'Location Unsupported';
      el.locationPill.className = 'mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200';
    }
  }

  function getDeviceLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your device browser.'));
      }

      showLoading('Acquiring GPS Location', 'Verifying employee physical location for attendance...');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          hideLoading();
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          });
        },
        (error) => {
          hideLoading();
          let msg = 'Could not access device location.';
          if (error.code === error.PERMISSION_DENIED) {
            msg = 'Location permission was denied. Please allow location access in your browser settings to clock in.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = 'GPS location information is currently unavailable.';
          } else if (error.code === error.TIMEOUT) {
            msg = 'GPS location request timed out. Please try again.';
          }
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  }

  // --- GOOGLE IDENTITY SERVICES (GIS) AUTHENTICATION ---
  function initGoogleAuth() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2 && settings.clientId) {
      try {
        // Only requires basic profile & email scopes (NO scary Drive/Spreadsheet full access dialog!)
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: settings.clientId.trim(),
          scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          prompt: 'select_account', // Prompts Google account chooser so user selects their Gmail
          callback: handleGoogleAuthResponse
        });
      } catch (err) {
        console.warn('Google OAuth Token Client initialization error:', err);
      }
    }
  }

  async function handleGoogleAuthResponse(tokenResponse) {
    if (tokenResponse.error) {
      hideLoading();
      alert('Google Sign-In Error: ' + tokenResponse.error);
      return;
    }

    try {
      showLoading('Verifying Gmail Account', 'Checking authenticated Google credentials...');
      
      // Fetch verified user profile from Google UserInfo endpoint
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve user info from Google.');
      const profile = await res.json();

      const user = {
        email: profile.email,
        name: profile.name || profile.given_name || 'Staff Member',
        picture: profile.picture || ''
      };

      await executeClockIn(user);
    } catch (err) {
      hideLoading();
      alert('Sign-In Verification Error: ' + err.message);
    }
  }

  // --- CLOCK-IN WITH GOOGLE GMAIL ---
  async function triggerClockIn() {
    if (settings.clientId && settings.clientId.trim().length > 0) {
      if (!tokenClient) initGoogleAuth();
      showLoading('Connecting to Google', 'Opening Google Sign-In account chooser...');
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } else {
      alert('Google Sign-In Required:\n\nTo ensure employees sign in with their genuine Gmail account and prevent time theft, please enter your Google OAuth Client ID in Settings (or in config.js).');
      openSettingsModal();
    }
  }

  async function executeClockIn(user) {
    try {
      // 1. Capture exact GPS Geolocation
      const location = await getDeviceLocation();

      // 2. Prepare timestamp & coordinates
      const now = new Date();
      const timestampStr = formatDateTime(now);
      const mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

      // 3. Send payload to Google Apps Script Webhook
      if (settings.scriptUrl && settings.scriptUrl.trim().length > 0) {
        showLoading('Updating Google Sheet', 'Recording clock-in to spreadsheet via Apps Script...');
        try {
          await postToGoogleAppsScript({
            action: 'clockin',
            email: user.email,
            name: user.name,
            latitude: location.latitude.toFixed(5),
            longitude: location.longitude.toFixed(5),
            accuracy: Math.round(location.accuracy),
            timestamp: timestampStr
          });
        } catch (err) {
          console.warn('Google Sheet submission note:', err);
        } finally {
          hideLoading();
        }
      }

      // 4. Save Active Shift
      const shiftData = {
        id: 'shift_' + Date.now(),
        email: user.email,
        name: user.name,
        picture: user.picture || '',
        clockInTime: timestampStr,
        clockInIso: now.toISOString(),
        latitude: location.latitude.toFixed(5),
        longitude: location.longitude.toFixed(5),
        accuracy: Math.round(location.accuracy),
        mapsUrl: mapsUrl,
        status: 'Clocked In'
      };

      activeShift = shiftData;
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(shiftData));
      appendHistoryRecord(shiftData);

      // 5. Present Screen 2 ("Have a Great work day!")
      showActiveShiftScreen(shiftData);

    } catch (err) {
      hideLoading();
      alert('Clock-In Error: ' + err.message);
    }
  }

  // --- CLOCK-OUT FLOW ---
  async function triggerClockOut() {
    if (!activeShift) return;

    const confirmOut = confirm(`Clock out now, ${activeShift.name}?\nYour end time will be recorded in the Google Sheet and you will be signed out.`);
    if (!confirmOut) return;

    showLoading('Clocking Out', 'Updating Google Sheet with your clock-out time...');

    const now = new Date();
    const clockOutTimeStr = formatDateTime(now);

    // Calculate shift duration accurately from epoch milliseconds
    let durationStr = '0m';
    if (activeShift.clockInIso) {
      const startMs = new Date(activeShift.clockInIso).getTime();
      const endMs = now.getTime();
      const diffMs = Math.max(0, endMs - startMs);
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;

      if (hours > 0) {
        durationStr = `${hours}h ${mins}m`;
      } else if (mins > 0) {
        durationStr = `${mins}m ${secs}s`;
      } else {
        durationStr = `${secs}s`;
      }
    }

    // Send clockout to Google Apps Script (updates same row)
    if (settings.scriptUrl && settings.scriptUrl.trim().length > 0) {
      try {
        await postToGoogleAppsScript({
          action: 'clockout',
          email: activeShift.email,
          name: activeShift.name,
          timestamp: clockOutTimeStr,
          duration: durationStr,
          clockInIso: activeShift.clockInIso,
          clockOutIso: now.toISOString()
        });
      } catch (err) {
        console.warn('Google Apps Script clockout warning:', err);
      }
    }

    // Update Local History
    updateHistoryClockOut(activeShift.id, clockOutTimeStr, durationStr);

    hideLoading();

    // Show farewell summary
    el.farewellMessage.textContent = `Great work today, ${activeShift.name}! You worked ${durationStr}. Your clock-out was recorded at ${clockOutTimeStr}.`;
    el.farewellModal.classList.remove('hidden');

    // Reset shift session
    if (shiftTimerInterval) {
      clearInterval(shiftTimerInterval);
      shiftTimerInterval = null;
    }
    activeShift = null;
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);
  }

  // POST helper for Google Apps Script Web App (handles no-cors redirect seamlessly)
  function postToGoogleAppsScript(payload) {
    return new Promise((resolve) => {
      if (!settings.scriptUrl) return resolve({ success: true, localOnly: true });

      fetch(settings.scriptUrl, {
        method: 'POST',
        mode: 'no-cors', // Standard for Google Apps Script Web Apps to prevent CORS block
        cache: 'no-cache',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(() => resolve({ success: true }))
        .catch(() => resolve({ success: true }));
    });
  }

  // --- SCREEN SWITCHERS ---
  function showClockInScreen() {
    el.screenActiveShift.classList.add('hidden');
    el.screenClockIn.classList.remove('hidden');

    if (shiftTimerInterval) {
      clearInterval(shiftTimerInterval);
      shiftTimerInterval = null;
    }
  }

  function showActiveShiftScreen(shift) {
    el.screenClockIn.classList.add('hidden');
    el.screenActiveShift.classList.remove('hidden');

    // Greeting & Verified Identity
    if (el.userName) el.userName.textContent = shift.name || 'Staff Member';
    if (el.userEmail) el.userEmail.textContent = shift.email || '';

    // Avatar
    if (shift.picture) {
      if (el.userAvatarInitials) el.userAvatarInitials.classList.add('hidden');
      if (el.userAvatarImg) {
        el.userAvatarImg.src = shift.picture;
        el.userAvatarImg.classList.remove('hidden');
      }
    } else {
      if (el.userAvatarImg) el.userAvatarImg.classList.add('hidden');
      const initials = (shift.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      if (el.userAvatarInitials) {
        el.userAvatarInitials.textContent = initials;
        el.userAvatarInitials.classList.remove('hidden');
      }
    }

    // Shift Details
    if (el.shiftClockInTime) el.shiftClockInTime.textContent = shift.clockInTime || '--:--';
    if (el.shiftCoords) el.shiftCoords.textContent = `${shift.latitude}°, ${shift.longitude}°`;
    if (el.shiftAccuracy) el.shiftAccuracy.textContent = `(±${shift.accuracy || 10}m)`;
    if (el.shiftMapsLink) el.shiftMapsLink.href = shift.mapsUrl || `https://www.google.com/maps?q=${shift.latitude},${shift.longitude}`;

    // Sync Status
    if (el.syncStatusText && el.syncStatusBadge) {
      if (settings.scriptUrl) {
        el.syncStatusText.textContent = 'Logged to Google Sheet via Google Apps Script';
        el.syncStatusBadge.className = 'flex items-center gap-1.5 text-[10px] sm:text-[11px] text-emerald-800 bg-emerald-50 rounded-lg p-2 border border-emerald-200';
      } else {
        el.syncStatusText.textContent = 'Stored locally (Add Google Apps Script URL in Settings to sync)';
        el.syncStatusBadge.className = 'flex items-center gap-1.5 text-[10px] sm:text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2 border border-amber-200';
      }
    }

    // Start Live Shift Duration Counter
    startShiftDurationTimer(shift.clockInIso || new Date().toISOString());
  }

  function startShiftDurationTimer(isoStartTime) {
    if (shiftTimerInterval) clearInterval(shiftTimerInterval);

    const startTime = new Date(isoStartTime).getTime();

    function update() {
      const now = Date.now();
      const diffMs = Math.max(0, now - startTime);
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      const pad = (n) => String(n).padStart(2, '0');
      el.shiftDurationTimer.textContent = `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    }

    update();
    shiftTimerInterval = setInterval(update, 1000);
  }

  // --- LOCAL HISTORY MANAGEMENT ---
  function appendHistoryRecord(record) {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
    history.unshift(record);
    if (history.length > 50) history.pop();
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  }

  function updateHistoryClockOut(shiftId, clockOutTime, duration) {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
    const record = history.find(item => item.id === shiftId || (item.email === activeShift?.email && item.status === 'Clocked In'));
    if (record) {
      record.clockOutTime = clockOutTime;
      record.duration = duration;
      record.status = 'Completed';
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    }
  }

  function renderHistoryModal() {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
    el.historyListContainer.innerHTML = '';

    if (history.length === 0) {
      el.historyListContainer.innerHTML = `
        <div class="text-center py-8 text-warmgray-500">
          <p class="text-sm font-medium">No shift records found yet.</p>
          <p class="text-xs text-warmgray-400 mt-1">Clock-ins will appear here and in your Google Sheet.</p>
        </div>
      `;
      return;
    }

    history.forEach(item => {
      const isCompleted = item.status === 'Completed';
      const card = document.createElement('div');
      card.className = 'p-3 rounded-2xl bg-white/90 border border-warmgray-200/80 shadow-xs space-y-1.5 text-xs';

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <span class="font-bold text-warmgray-900">${escapeHtml(item.name || 'Employee')}</span>
            <span class="text-blue-700 font-mono text-[11px] ml-1">(${escapeHtml(item.email)})</span>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 animate-pulse'}">
            ${escapeHtml(item.status || 'Active')}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-warmgray-700 pt-1">
          <div>
            <span class="text-[10px] text-warmgray-400 uppercase font-semibold block">Clock In</span>
            <span class="font-mono text-[11px] font-medium">${escapeHtml(item.clockInTime || '--')}</span>
          </div>
          <div>
            <span class="text-[10px] text-warmgray-400 uppercase font-semibold block">Clock Out</span>
            <span class="font-mono text-[11px] font-medium">${escapeHtml(item.clockOutTime || '(Active Shift)')}</span>
          </div>
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-warmgray-100 text-[11px]">
          <span class="text-warmgray-500">📍 ${escapeHtml(item.latitude || '')}, ${escapeHtml(item.longitude || '')} (±${item.accuracy || 0}m)</span>
          ${item.mapsUrl ? `<a href="${escapeHtml(item.mapsUrl)}" target="_blank" class="text-amber-700 hover:underline font-medium">Map Link ↗</a>` : ''}
        </div>
      `;
      el.historyListContainer.appendChild(card);
    });
  }

  // --- UI SPINNERS & FORMATTING ---
  function showLoading(title, subtitle) {
    el.loadingTitle.textContent = title || 'Processing';
    el.loadingSubtitle.textContent = subtitle || 'Please wait...';
    el.loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    el.loadingOverlay.classList.add('hidden');
  }

  function formatDateTime(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const time = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    return `${month} ${day}, ${year} ${time}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function openSettingsModal() {
    el.inputRestaurantName.value = settings.restaurantName || '';
    el.inputRestaurantLogo.value = settings.restaurantLogo || '';
    el.inputClientId.value = settings.clientId || '';
    el.inputScriptUrl.value = settings.scriptUrl || '';
    el.settingsModal.classList.remove('hidden');
  }

  // --- MOBILE HAPTIC FEEDBACK ---
  function triggerHaptic() {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch (e) {}
    }
  }

  // --- EVENT LISTENERS ---
  function bindEvents() {
    // Clock-In with Google Button Trigger
    el.btnClockInTrigger.addEventListener('click', () => {
      triggerHaptic();
      triggerClockIn();
    });

    // Quick Setup Link in warning banner
    if (el.btnQuickSetup) {
      el.btnQuickSetup.addEventListener('click', () => {
        triggerHaptic();
        openSettingsModal();
      });
    }

    // Clock-Out Button Trigger
    el.btnClockOutTrigger.addEventListener('click', () => {
      triggerHaptic();
      triggerClockOut();
    });

    // Farewell Modal Dismiss
    el.btnCloseFarewell.addEventListener('click', () => {
      triggerHaptic();
      el.farewellModal.classList.add('hidden');
      showClockInScreen();
    });

    // History Modal
    el.btnOpenHistory.addEventListener('click', () => {
      renderHistoryModal();
      el.historyModal.classList.remove('hidden');
    });
    el.btnCloseHistory.addEventListener('click', () => el.historyModal.classList.add('hidden'));
    el.btnCloseHistoryBottom.addEventListener('click', () => el.historyModal.classList.add('hidden'));
    el.btnClearHistory.addEventListener('click', () => {
      if (confirm('Clear all local shift records? This does not delete rows from your Google Sheet.')) {
        localStorage.removeItem(STORAGE_KEYS.HISTORY);
        renderHistoryModal();
      }
    });

    // Settings Modal
    el.btnOpenSettings.addEventListener('click', openSettingsModal);

    const closeSettings = () => el.settingsModal.classList.add('hidden');
    el.btnCloseSettings.addEventListener('click', closeSettings);
    el.btnCancelSettings.addEventListener('click', closeSettings);

    el.btnSaveSettings.addEventListener('click', () => {
      settings.restaurantName = el.inputRestaurantName.value.trim() || 'Bella Bistro & Bar';
      settings.restaurantLogo = el.inputRestaurantLogo.value.trim();
      settings.clientId = el.inputClientId.value.trim();
      settings.scriptUrl = el.inputScriptUrl.value.trim();

      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      applyBrandSettings();
      updateSetupWarningVisibility();
      initGoogleAuth();
      closeSettings();
      alert('Settings saved! Ready for Google Sign-In & Google Apps Script sync.');
    });
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
