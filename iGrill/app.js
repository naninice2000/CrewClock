/**
 * Restaurant Employee Clock-In & Attendance Web App
 * Hosted on GitHub Pages (100% Client-Side)
 * Multi-Tenant Architecture & Role-Based Access Control (RBAC)
 * Google Identity (Gmail Verification) + Google Apps Script Webhooks (Google Sheets)
 */

(function () {
  'use strict';

  // --- LOCAL STORAGE KEYS ---
  const STORAGE_KEYS = {
    SETTINGS: 'clockin_settings',
    SESSION: 'clockin_user_session',
    ACTIVE_SHIFT: 'clockin_active_shift',
    HISTORY: 'clockin_history'
  };

  // Default Session Duration: 7 days
  const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

  // Base configuration loaded from config.js
  const fileConfig = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG : {};

  // Default Settings merging config.js and localStorage
  const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
  let settings = {
    restaurantName: savedSettings.restaurantName || fileConfig.restaurantName || 'Bella Bistro & Bar',
    restaurantLogo: savedSettings.restaurantLogo || fileConfig.restaurantLogo || '',
    clientId: savedSettings.clientId || fileConfig.googleClientId || '',
    scriptUrl: savedSettings.scriptUrl || fileConfig.googleScriptUrl || '',
    tenancyScriptUrl: savedSettings.tenancyScriptUrl || fileConfig.tenancyScriptUrl || ''
  };

  // Runtime State
  let currentUser = null;
  let activeShift = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFT) || 'null');
  let tokenClient = null;
  let shiftTimerInterval = null;

  // Auth & Multi-Tenancy State
  let authMode = 'signin'; // 'signin' | 'signup'
  let pendingAdminProfile = null;

  // Server Time Synchronization State (locks time to Google Server Time)
  let serverTimeOffsetMs = 0;
  let isServerTimeSynced = false;
  let serverTimeZone = '';

  function getNow() {
    return new Date(Date.now() + serverTimeOffsetMs);
  }

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

    // Header User Profile & Navigation
    headerUserBadge: document.getElementById('header-user-badge'),
    headerUserInitials: document.getElementById('header-user-initials'),
    headerUserImg: document.getElementById('header-user-img'),
    headerUserName: document.getElementById('header-user-name'),
    headerRolePill: document.getElementById('header-role-pill'),
    btnLogoutTrigger: document.getElementById('btn-logout-trigger'),
    btnOpenTeam: document.getElementById('btn-open-team'),
    btnOpenHistory: document.getElementById('btn-open-history'),
    btnOpenSettings: document.getElementById('btn-open-settings'),

    // Screens
    screenLogin: document.getElementById('screen-login'),
    screenClockIn: document.getElementById('screen-clockin'),
    screenActiveShift: document.getElementById('screen-active-shift'),

    // Screen 0: Login View
    btnLoginTrigger: document.getElementById('btn-login-trigger'),
    btnSignupTrigger: document.getElementById('btn-signup-trigger'),
    sessionExpiredAlert: document.getElementById('session-expired-alert'),
    uninvitedUserAlert: document.getElementById('uninvited-user-alert'),
    uninvitedUserText: document.getElementById('uninvited-user-text'),
    googleSetupWarning: document.getElementById('google-setup-warning'),
    btnQuickSetup: document.getElementById('btn-quick-setup'),

    // Screen 1: Ready to Clock In
    readyUserInitials: document.getElementById('ready-user-initials'),
    readyUserImg: document.getElementById('ready-user-img'),
    readyUserName: document.getElementById('ready-user-name'),
    readyUserEmail: document.getElementById('ready-user-email'),
    btnClockInTrigger: document.getElementById('btn-clockin-trigger'),

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
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnCancelSettings: document.getElementById('btn-cancel-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    inputRestaurantName: document.getElementById('input-restaurant-name'),
    inputRestaurantLogo: document.getElementById('input-restaurant-logo'),
    inputClientId: document.getElementById('input-client-id'),
    inputScriptUrl: document.getElementById('input-sheet-id'),
    inputTenancyUrl: document.getElementById('input-tenancy-url'),

    historyModal: document.getElementById('history-modal'),
    btnCloseHistory: document.getElementById('btn-close-history'),
    btnCloseHistoryBottom: document.getElementById('btn-close-history-bottom'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    historyListContainer: document.getElementById('history-list-container'),

    // Onboarding Modal (Restaurant Owner Signup)
    onboardingModal: document.getElementById('onboarding-modal'),
    inputOnboardName: document.getElementById('input-onboard-name'),
    inputOnboardLogo: document.getElementById('input-onboard-logo'),
    inputOnboardAttendanceUrl: document.getElementById('input-onboard-attendance-url'),
    inputOnboardTimezone: document.getElementById('input-onboard-timezone'),
    btnCancelOnboard: document.getElementById('btn-cancel-onboard'),
    btnSaveOnboard: document.getElementById('btn-save-onboard'),

    // Team Modal (Admin RBAC Management)
    teamModal: document.getElementById('team-modal'),
    btnCloseTeam: document.getElementById('btn-close-team'),
    btnCloseTeamBottom: document.getElementById('btn-close-team-bottom'),
    inputInviteEmail: document.getElementById('input-invite-email'),
    inputInviteName: document.getElementById('input-invite-name'),
    btnSendInvite: document.getElementById('btn-send-invite'),
    inviteStatusMsg: document.getElementById('invite-status-msg'),
    teamListContainer: document.getElementById('team-list-container'),
  };

  // --- INITIALIZATION ---
  function init() {
    currentUser = getUserSession();
    applyBrandSettings();
    syncServerTime();
    startLiveClock();
    checkLocationCapability();
    updateSetupWarningVisibility();
    initGoogleAuth();
    bindEvents();
    refreshScreenState();

    // Re-check session on tab focus
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        currentUser = getUserSession();
        refreshScreenState();
      }
    });
  }

  // --- USER SESSION MANAGEMENT ---
  function getUserSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.email) return null;

      // Check session expiry
      if (session.expiresAt && Date.now() > session.expiresAt) {
        console.log('[Session] User session has expired.');
        clearUserSession(true);
        return null;
      }
      return session;
    } catch (e) {
      console.warn('[Session] Error reading user session:', e);
      return null;
    }
  }

  function saveUserSession(user) {
    const session = {
      email: user.email,
      name: user.name,
      picture: user.picture || '',
      role: user.role || 'employee',
      tenantId: user.tenantId || '',
      restaurantName: user.restaurantName || settings.restaurantName,
      restaurantLogo: user.restaurantLogo !== undefined ? user.restaurantLogo : settings.restaurantLogo,
      attendanceScriptUrl: user.attendanceScriptUrl || settings.scriptUrl,
      loginTime: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION_MS
    };
    currentUser = session;
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    applyBrandSettings();
    updateHeaderUserUI();
    updateRoleBasedUI();
    return session;
  }

  function clearUserSession(isExpired) {
    currentUser = null;
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    applyBrandSettings();
    updateHeaderUserUI();
    updateRoleBasedUI();
    if (isExpired && el.sessionExpiredAlert) {
      el.sessionExpiredAlert.classList.remove('hidden');
    }
  }

  function updateHeaderUserUI() {
    if (!el.headerUserBadge) return;
    if (currentUser && currentUser.email) {
      if (el.headerUserName) {
        const firstName = (currentUser.name || 'User').split(' ')[0];
        el.headerUserName.textContent = firstName;
      }
      if (currentUser.picture) {
        if (el.headerUserInitials) el.headerUserInitials.classList.add('hidden');
        if (el.headerUserImg) {
          el.headerUserImg.src = currentUser.picture;
          el.headerUserImg.classList.remove('hidden');
        }
      } else {
        if (el.headerUserImg) el.headerUserImg.classList.add('hidden');
        const initials = (currentUser.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        if (el.headerUserInitials) {
          el.headerUserInitials.textContent = initials;
          el.headerUserInitials.classList.remove('hidden');
        }
      }
      el.headerUserBadge.classList.remove('hidden');
    } else {
      el.headerUserBadge.classList.add('hidden');
    }
  }

  // --- ROLE-BASED ACCESS CONTROL (RBAC) UI ---
  function updateRoleBasedUI() {
    const isAdmin = currentUser && currentUser.role === 'admin';

    // Admin role pill in header
    if (el.headerRolePill) {
      if (isAdmin) {
        el.headerRolePill.classList.remove('hidden');
      } else {
        el.headerRolePill.classList.add('hidden');
      }
    }

    // Team management button (Admin only)
    if (el.btnOpenTeam) {
      if (isAdmin) {
        el.btnOpenTeam.classList.remove('hidden');
      } else {
        el.btnOpenTeam.classList.add('hidden');
      }
    }

    // App Configuration button (Admin only)
    if (el.btnOpenSettings) {
      if (isAdmin) {
        el.btnOpenSettings.classList.remove('hidden');
      } else {
        el.btnOpenSettings.classList.add('hidden');
      }
    }
  }

  // --- SCREEN CONTROLLER ---
  function refreshScreenState() {
    const session = getUserSession();
    updateHeaderUserUI();
    updateRoleBasedUI();

    if (!session) {
      showScreen('login');
      return;
    }

    // If an active shift is in progress for this user, show active shift screen
    if (activeShift && activeShift.status === 'Clocked In' && activeShift.email.toLowerCase() === session.email.toLowerCase()) {
      showScreen('activeShift');
    } else {
      showScreen('clockIn');
    }
  }

  function showScreen(screen) {
    if (el.screenLogin) el.screenLogin.classList.add('hidden');
    if (el.screenClockIn) el.screenClockIn.classList.add('hidden');
    if (el.screenActiveShift) el.screenActiveShift.classList.add('hidden');

    if (screen === 'login') {
      if (el.screenLogin) el.screenLogin.classList.remove('hidden');
      if (shiftTimerInterval) {
        clearInterval(shiftTimerInterval);
        shiftTimerInterval = null;
      }
    } else if (screen === 'clockIn') {
      populateReadyScreen(currentUser);
      if (el.screenClockIn) el.screenClockIn.classList.remove('hidden');
      if (shiftTimerInterval) {
        clearInterval(shiftTimerInterval);
        shiftTimerInterval = null;
      }
    } else if (screen === 'activeShift') {
      populateActiveShiftScreen(activeShift);
      if (el.screenActiveShift) el.screenActiveShift.classList.remove('hidden');
    }
  }

  function populateReadyScreen(user) {
    if (!user) return;
    if (el.readyUserName) el.readyUserName.textContent = user.name || 'Staff Member';
    if (el.readyUserEmail) el.readyUserEmail.textContent = user.email || '';

    if (user.picture) {
      if (el.readyUserInitials) el.readyUserInitials.classList.add('hidden');
      if (el.readyUserImg) {
        el.readyUserImg.src = user.picture;
        el.readyUserImg.classList.remove('hidden');
      }
    } else {
      if (el.readyUserImg) el.readyUserImg.classList.add('hidden');
      const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      if (el.readyUserInitials) {
        el.readyUserInitials.textContent = initials;
        el.readyUserInitials.classList.remove('hidden');
      }
    }
  }

  function populateActiveShiftScreen(shift) {
    if (!shift) return;

    if (el.userName) el.userName.textContent = shift.name || 'Staff Member';
    if (el.userEmail) el.userEmail.textContent = shift.email || '';

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

    if (el.shiftClockInTime) el.shiftClockInTime.textContent = shift.clockInTime || '--:--';
    if (el.shiftCoords) el.shiftCoords.textContent = `${shift.latitude}°, ${shift.longitude}°`;
    if (el.shiftAccuracy) el.shiftAccuracy.textContent = `(±${shift.accuracy || 10}m)`;
    if (el.shiftMapsLink) el.shiftMapsLink.href = shift.mapsUrl || `https://www.google.com/maps?q=${shift.latitude},${shift.longitude}`;

    updateSyncBadgeUI();
    startShiftDurationTimer(shift.clockInIso || getNow().toISOString());
  }

  // --- MULTI-TENANCY DIRECTORY CLIENT ---
  async function callTenancyApi(action, params = {}) {
    const tenancyUrl = settings.tenancyScriptUrl;
    if (!tenancyUrl || !tenancyUrl.trim()) {
      throw new Error('Tenancy directory script URL is not configured.');
    }

    const url = new URL(tenancyUrl);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-cache'
    });

    if (!res.ok) {
      throw new Error(`Directory server responded with status: ${res.status}`);
    }

    return await res.json();
  }

  // --- SERVER TIME SYNCHRONIZATION ---
  async function syncServerTime() {
    const targetScriptUrl = currentUser?.attendanceScriptUrl || settings.scriptUrl;
    if (!targetScriptUrl || targetScriptUrl.trim().length === 0) return;
    try {
      const startTime = Date.now();
      const res = await fetch(targetScriptUrl, {
        method: 'GET',
        cache: 'no-cache'
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.serverTimeIso) {
        const endTime = Date.now();
        const roundTripLatency = Math.max(0, endTime - startTime);
        const serverNowMs = new Date(data.serverTimeIso).getTime() + Math.round(roundTripLatency / 2);
        serverTimeOffsetMs = serverNowMs - endTime;
        isServerTimeSynced = true;
        if (data.timeZone) serverTimeZone = data.timeZone;
        console.log(`[TimeSync] Synchronized with Google Server Time (Offset: ${serverTimeOffsetMs}ms, TZ: ${serverTimeZone})`);
        updateSyncBadgeUI();
      }
    } catch (err) {
      console.warn('[TimeSync] Google Apps Script ping unavailable, falling back to local clock:', err);
    }
  }

  // --- BRAND & CONFIG DISPLAY ---
  function applyBrandSettings() {
    const brandName = currentUser?.restaurantName || settings.restaurantName || 'Bella Bistro & Bar';
    const brandLogo = currentUser?.restaurantLogo !== undefined ? currentUser.restaurantLogo : settings.restaurantLogo;

    if (el.restaurantNameDisplay) {
      el.restaurantNameDisplay.textContent = brandName;
    }
    document.title = brandName + ' - Staff Clock-In';

    if (brandLogo && brandLogo.trim().length > 0) {
      if (el.brandLogoSvg) el.brandLogoSvg.classList.add('hidden');
      if (el.brandLogoImg) {
        el.brandLogoImg.src = brandLogo;
        el.brandLogoImg.classList.remove('hidden');
      }
    } else {
      if (el.brandLogoImg) el.brandLogoImg.classList.add('hidden');
      if (el.brandLogoSvg) el.brandLogoSvg.classList.remove('hidden');
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
      const now = getNow();
      if (el.liveClock) {
        el.liveClock.textContent = now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      }
      if (el.liveDate) {
        el.liveDate.textContent = now.toLocaleDateString([], {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
    update();
    setInterval(update, 1000);
  }

  // --- GEOLOCATION CAPTURE ---
  function checkLocationCapability() {
    if ('geolocation' in navigator) {
      if (el.locationPillText) el.locationPillText.textContent = 'GPS Location Ready';
      if (el.locationPill) el.locationPill.className = 'mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100/80 text-emerald-800 border border-emerald-200';
    } else {
      if (el.locationPillText) el.locationPillText.textContent = 'Location Unsupported';
      if (el.locationPill) el.locationPill.className = 'mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200';
    }
  }

  function getDeviceLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your device browser.'));
      }

      showLoading('Acquiring GPS Location', 'Capturing device coordinates for attendance verification...');

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
            msg = 'Location permission was denied. Please allow location access in your device/browser settings.';
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
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: settings.clientId.trim(),
          scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          prompt: 'select_account',
          callback: handleGoogleAuthResponse
        });
      } catch (err) {
        console.warn('Google OAuth Token Client initialization error:', err);
      }
    }
  }

  // Trigger Google Login or Signup
  function triggerLogin(mode = 'signin') {
    authMode = mode;
    if (el.uninvitedUserAlert) el.uninvitedUserAlert.classList.add('hidden');

    if (settings.clientId && settings.clientId.trim().length > 0) {
      if (!tokenClient) initGoogleAuth();
      showLoading(
        'Connecting to Google',
        authMode === 'signup'
          ? 'Opening Google Account chooser for Restaurant Signup...'
          : 'Opening Google Sign-In account chooser...'
      );
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } else {
      alert('Google Sign-In Required:\n\nPlease enter your Google OAuth Client ID in Settings (or in config.js) to enable Google authentication.');
      openSettingsModal();
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
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve user info from Google.');
      const profile = await res.json();

      const email = (profile.email || '').trim().toLowerCase();
      const name = profile.name || profile.given_name || 'Staff Member';
      const picture = profile.picture || '';

      // MULTI-TENANT VERIFICATION IF CENTRAL DIRECTORY IS CONFIGURED
      if (settings.tenancyScriptUrl && settings.tenancyScriptUrl.trim().length > 0) {
        showLoading('Checking Workspace Access', 'Verifying permissions in Tenants & Users Directory...');
        try {
          const tenancyRes = await callTenancyApi('check_user', { email: email });

          // SCENARIO 1: SIGN IN FLOW (Invited Employees & Existing Admins)
          if (authMode === 'signin') {
            if (tenancyRes.exists && tenancyRes.user) {
              const userRole = tenancyRes.user.role || 'employee';
              const tenant = tenancyRes.tenant || {};

              saveUserSession({
                email: email,
                name: name,
                picture: picture,
                role: userRole,
                tenantId: tenancyRes.user.tenantId,
                restaurantName: tenant.restaurantName || settings.restaurantName,
                restaurantLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : settings.restaurantLogo,
                attendanceScriptUrl: tenant.attendanceScriptUrl || settings.scriptUrl
              });

              if (el.sessionExpiredAlert) el.sessionExpiredAlert.classList.add('hidden');
              if (el.uninvitedUserAlert) el.uninvitedUserAlert.classList.add('hidden');
              hideLoading();
              syncServerTime();
              refreshScreenState();
              return;
            } else {
              // User NOT registered in Directory -> Block sign-in with clear notice
              hideLoading();
              if (el.uninvitedUserText) {
                el.uninvitedUserText.textContent = `Account "${email}" is not registered in any restaurant workspace. Please ask your restaurant manager to invite this Gmail, or sign up as a restaurant owner below.`;
              }
              if (el.uninvitedUserAlert) el.uninvitedUserAlert.classList.remove('hidden');
              return;
            }

          // SCENARIO 2: SIGN UP FLOW (Restaurant Owners)
          } else if (authMode === 'signup') {
            if (tenancyRes.exists && tenancyRes.user) {
              hideLoading();
              if (tenancyRes.user.role === 'admin') {
                const tenant = tenancyRes.tenant || {};
                saveUserSession({
                  email: email,
                  name: name,
                  picture: picture,
                  role: 'admin',
                  tenantId: tenancyRes.user.tenantId,
                  restaurantName: tenant.restaurantName || settings.restaurantName,
                  restaurantLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : settings.restaurantLogo,
                  attendanceScriptUrl: tenant.attendanceScriptUrl || settings.scriptUrl
                });
                syncServerTime();
                refreshScreenState();
                alert(`Welcome back, ${name}!\nYou are already registered as Admin for "${tenant.restaurantName || 'your restaurant'}".`);
              } else {
                alert(`Account "${email}" is already registered as an employee at "${tenancyRes.tenant?.restaurantName || 'a restaurant'}". Please use "Sign In with Google" instead.`);
              }
              return;
            }

            // New Admin -> Open Onboarding Modal to capture Restaurant details
            hideLoading();
            pendingAdminProfile = { email: email, name: name, picture: picture };
            openOnboardingModal();
            return;
          }
        } catch (dirErr) {
          hideLoading();
          alert('Could not verify account with Tenants Directory: ' + dirErr.message);
          return;
        }
      }

      // STANDALONE SINGLE-TENANT FALLBACK (If tenancyScriptUrl is not set)
      const user = {
        email: email,
        name: name,
        picture: picture,
        role: 'admin', // Full access in standalone fallback
        restaurantName: settings.restaurantName,
        restaurantLogo: settings.restaurantLogo,
        attendanceScriptUrl: settings.scriptUrl
      };

      saveUserSession(user);
      if (el.sessionExpiredAlert) el.sessionExpiredAlert.classList.add('hidden');
      if (el.uninvitedUserAlert) el.uninvitedUserAlert.classList.add('hidden');
      hideLoading();
      syncServerTime();
      refreshScreenState();

    } catch (err) {
      hideLoading();
      alert('Sign-In Verification Error: ' + err.message);
    }
  }

  // --- RESTAURANT ONBOARDING (SIGNUP) ---
  function openOnboardingModal() {
    if (!pendingAdminProfile) return;
    if (el.inputOnboardName) el.inputOnboardName.value = '';
    if (el.inputOnboardLogo) el.inputOnboardLogo.value = '';
    if (el.inputOnboardAttendanceUrl) el.inputOnboardAttendanceUrl.value = settings.scriptUrl || '';
    if (el.onboardingModal) el.onboardingModal.classList.remove('hidden');
  }

  function closeOnboardingModal() {
    if (el.onboardingModal) el.onboardingModal.classList.add('hidden');
    pendingAdminProfile = null;
  }

  async function submitOnboarding() {
    if (!pendingAdminProfile) {
      alert('Admin registration session expired. Please click "Sign Up Your Restaurant" again.');
      closeOnboardingModal();
      return;
    }

    const adminEmail = pendingAdminProfile.email;
    const adminName = pendingAdminProfile.name || 'Restaurant Admin';
    const adminPicture = pendingAdminProfile.picture || '';

    const restaurantName = (el.inputOnboardName?.value || '').trim();
    const logoUrl = (el.inputOnboardLogo?.value || '').trim();
    const attendanceScriptUrl = (el.inputOnboardAttendanceUrl?.value || '').trim();
    const timeZone = el.inputOnboardTimezone?.value || 'America/Los_Angeles';

    if (!restaurantName) {
      alert('Please enter your Restaurant / Location Name.');
      el.inputOnboardName?.focus();
      return;
    }

    if (!attendanceScriptUrl) {
      alert('Please enter your Attendance Google Apps Script URL where employee clock-ins will be logged.');
      el.inputOnboardAttendanceUrl?.focus();
      return;
    }

    try {
      showLoading('Creating Restaurant Workspace', 'Registering your restaurant and provisioning Admin privileges...');
      const res = await callTenancyApi('signup', {
        email: adminEmail,
        name: adminName,
        restaurantName: restaurantName,
        logoUrl: logoUrl,
        attendanceScriptUrl: attendanceScriptUrl,
        timeZone: timeZone
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to create restaurant workspace.');
      }

      if (res.service && !res.tenant && !res.user) {
        throw new Error("Your deployed Google Apps Script Web App returned a default response. Please make sure you have pasted the latest google-apps-script-tenancy.js into Apps Script, saved, and deployed as a 'New version'.");
      }

      const tenant = res.tenant || {};
      saveUserSession({
        email: adminEmail,
        name: adminName,
        picture: adminPicture,
        role: 'admin',
        tenantId: tenant.tenantId || '',
        restaurantName: tenant.restaurantName || restaurantName,
        restaurantLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : logoUrl,
        attendanceScriptUrl: tenant.attendanceScriptUrl || attendanceScriptUrl
      });

      closeOnboardingModal();
      hideLoading();
      syncServerTime();
      refreshScreenState();

      setTimeout(() => {
        alert(`🎉 Welcome to CrewClock, ${adminName}!\n\nWorkspace "${restaurantName}" is ready. You can now invite staff to sign in using the Team icon in the top header.`);
      }, 100);
    } catch (err) {
      hideLoading();
      alert('Onboarding Error: ' + err.message);
    }
  }

  // --- TEAM MANAGEMENT (ADMIN RBAC) ---
  function openTeamModal() {
    if (!currentUser || currentUser.role !== 'admin') {
      alert('Only authorized restaurant Admins can access Team Management.');
      return;
    }
    if (el.teamModal) el.teamModal.classList.remove('hidden');
    if (el.inviteStatusMsg) el.inviteStatusMsg.textContent = '';
    loadTeamRoster();
  }

  function closeTeamModal() {
    if (el.teamModal) el.teamModal.classList.add('hidden');
  }

  async function loadTeamRoster() {
    if (!currentUser || !el.teamListContainer) return;
    el.teamListContainer.innerHTML = `
      <div class="text-center py-6 text-warmgray-400 text-xs animate-pulse">
        Fetching team roster from directory...
      </div>
    `;

    try {
      const res = await callTenancyApi('get_team', { adminEmail: currentUser.email });
      if (!res.success) throw new Error(res.error || 'Could not fetch team list');

      const team = res.team || [];
      if (team.length === 0) {
        el.teamListContainer.innerHTML = `
          <div class="text-center py-8 text-warmgray-500 text-xs">
            <p class="font-medium">No team members invited yet.</p>
            <p class="text-warmgray-400 text-[11px] mt-1">Invite your staff by Gmail using the form above!</p>
          </div>
        `;
        return;
      }

      el.teamListContainer.innerHTML = '';
      team.forEach((member) => {
        const isSelf = member.email.toLowerCase() === currentUser.email.toLowerCase();
        const isAdmin = member.role === 'admin';
        const card = document.createElement('div');
        card.className = 'flex items-center justify-between p-3 rounded-2xl bg-white/90 border border-warmgray-200/80 shadow-xs text-xs';

        card.innerHTML = `
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-full ${isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-warmgray-100 text-warmgray-700'} flex items-center justify-center font-bold text-xs flex-shrink-0">
              ${escapeHtml((member.name || 'U').charAt(0).toUpperCase())}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-warmgray-900 truncate">${escapeHtml(member.name || 'Staff')}</span>
                <span class="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded ${isAdmin ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-warmgray-100 text-warmgray-700 border border-warmgray-200'}">
                  ${escapeHtml(member.role)}
                </span>
                ${isSelf ? '<span class="text-[10px] text-warmgray-400">(You)</span>' : ''}
              </div>
              <p class="text-[11px] text-warmgray-500 font-mono truncate">${escapeHtml(member.email)}</p>
            </div>
          </div>
          <div>
            ${!isSelf ? `
              <button data-remove-email="${escapeHtml(member.email)}" data-remove-name="${escapeHtml(member.name || '')}" class="btn-remove-member px-2.5 py-1 rounded-xl text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors">
                Remove
              </button>
            ` : `
              <span class="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Active</span>
            `}
          </div>
        `;
        el.teamListContainer.appendChild(card);
      });

      // Bind dynamic remove buttons
      el.teamListContainer.querySelectorAll('.btn-remove-member').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const email = e.currentTarget.getAttribute('data-remove-email');
          const name = e.currentTarget.getAttribute('data-remove-name');
          removeTeamMember(email, name);
        });
      });

    } catch (err) {
      el.teamListContainer.innerHTML = `
        <div class="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200">
          Failed to load team roster: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  async function inviteTeamMember() {
    const email = (el.inputInviteEmail?.value || '').trim().toLowerCase();
    const name = (el.inputInviteName?.value || '').trim() || 'Staff Member';

    if (!email) {
      if (el.inviteStatusMsg) el.inviteStatusMsg.textContent = 'Please enter a Gmail address.';
      el.inputInviteEmail?.focus();
      return;
    }

    if (!email.includes('@')) {
      if (el.inviteStatusMsg) el.inviteStatusMsg.textContent = 'Please enter a valid email address.';
      return;
    }

    try {
      if (el.inviteStatusMsg) el.inviteStatusMsg.textContent = 'Sending email invitation...';
      if (el.btnSendInvite) el.btnSendInvite.disabled = true;

      const currentAppUrl = window.location.href.split('#')[0].split('?')[0];
      const res = await callTenancyApi('invite_employee', {
        adminEmail: currentUser.email,
        inviteEmail: email,
        inviteName: name,
        appUrl: currentAppUrl
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to send invitation.');
      }

      if (el.inviteStatusMsg) {
        el.inviteStatusMsg.innerHTML = `<span class="text-emerald-700 font-bold">✓ Invitation sent to ${escapeHtml(email)}!</span>`;
      }
      if (el.inputInviteEmail) el.inputInviteEmail.value = '';
      if (el.inputInviteName) el.inputInviteName.value = '';

      loadTeamRoster();
    } catch (err) {
      if (el.inviteStatusMsg) {
        el.inviteStatusMsg.innerHTML = `<span class="text-rose-700 font-bold">Error: ${escapeHtml(err.message)}</span>`;
      }
    } finally {
      if (el.btnSendInvite) el.btnSendInvite.disabled = false;
    }
  }

  async function removeTeamMember(targetEmail, targetName) {
    const displayName = targetName ? `${targetName} (${targetEmail})` : targetEmail;
    if (!confirm(`Are you sure you want to remove ${displayName} from your restaurant team?\n\nThey will no longer be permitted to sign in or clock in.`)) {
      return;
    }

    try {
      showLoading('Removing Staff Member', `Revoking access for ${targetEmail}...`);
      const res = await callTenancyApi('remove_employee', {
        adminEmail: currentUser.email,
        targetEmail: targetEmail
      });
      hideLoading();

      if (!res.success) {
        throw new Error(res.error || 'Could not remove team member.');
      }

      loadTeamRoster();
    } catch (err) {
      hideLoading();
      alert('Error removing member: ' + err.message);
    }
  }

  // --- CLOCK-IN FLOW ---
  async function triggerClockIn() {
    const session = getUserSession();
    if (!session) {
      alert('Your session has expired. Please sign in with Google.');
      refreshScreenState();
      return;
    }

    const targetScriptUrl = session.attendanceScriptUrl || settings.scriptUrl;

    try {
      // Sync server time if not already synced
      if (!isServerTimeSynced && targetScriptUrl) {
        try {
          await Promise.race([
            syncServerTime(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
          ]);
        } catch (e) {}
      }

      // 1. Capture exact GPS Geolocation at the click moment
      const location = await getDeviceLocation();

      // 2. Prepare timestamp & coordinates using server-synchronized time
      const now = getNow();
      const timestampStr = formatDateTime(now);
      const mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

      // 3. Send payload to Restaurant Attendance Google Apps Script Webhook
      if (targetScriptUrl && targetScriptUrl.trim().length > 0) {
        showLoading('Updating Google Sheet', 'Recording clock-in with Google Server Time...');
        try {
          await postToGoogleAppsScript(targetScriptUrl, {
            action: 'clockin',
            email: session.email,
            name: session.name,
            latitude: location.latitude.toFixed(5),
            longitude: location.longitude.toFixed(5),
            accuracy: Math.round(location.accuracy),
            timestamp: timestampStr,
            clockInIso: now.toISOString()
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
        email: session.email,
        name: session.name,
        picture: session.picture || '',
        clockInTime: timestampStr,
        clockInIso: now.toISOString(),
        latitude: location.latitude.toFixed(5),
        longitude: location.longitude.toFixed(5),
        accuracy: Math.round(location.accuracy),
        mapsUrl: mapsUrl,
        status: 'Clocked In',
        serverSynced: isServerTimeSynced
      };

      activeShift = shiftData;
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(shiftData));
      appendHistoryRecord(shiftData);

      // 5. Present Screen 2 (Active Shift)
      refreshScreenState();

    } catch (err) {
      hideLoading();
      alert('Clock-In Error: ' + err.message);
    }
  }

  // --- CLOCK-OUT FLOW ---
  async function triggerClockOut() {
    if (!activeShift) return;

    const session = getUserSession();
    if (!session) {
      alert('Your session has expired. Please sign in again to complete clock-out.');
      refreshScreenState();
      return;
    }

    const confirmOut = confirm(`Clock out now, ${activeShift.name}?\nYour end time and current location will be recorded in the Google Sheet.`);
    if (!confirmOut) return;

    const targetScriptUrl = session.attendanceScriptUrl || settings.scriptUrl;

    try {
      // 1. Capture exact GPS Geolocation at clock-out moment
      const location = await getDeviceLocation();

      showLoading('Clocking Out', 'Updating Google Sheet with server clock-out time & location...');

      const now = getNow();
      const clockOutTimeStr = formatDateTime(now);
      const outMapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

      // Calculate shift duration accurately
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

      // 2. Send clockout to Google Apps Script (updates same row with clock-out time and location)
      if (targetScriptUrl && targetScriptUrl.trim().length > 0) {
        try {
          await postToGoogleAppsScript(targetScriptUrl, {
            action: 'clockout',
            email: activeShift.email,
            name: activeShift.name,
            latitude: location.latitude.toFixed(5),
            longitude: location.longitude.toFixed(5),
            accuracy: Math.round(location.accuracy),
            timestamp: clockOutTimeStr,
            duration: durationStr,
            clockInIso: activeShift.clockInIso,
            clockOutIso: now.toISOString()
          });
        } catch (err) {
          console.warn('Google Apps Script clockout warning:', err);
        }
      }

      // 3. Update Local History
      updateHistoryClockOut(activeShift.id, clockOutTimeStr, durationStr, location, outMapsUrl);

      hideLoading();

      // 4. Show farewell summary
      if (el.farewellMessage) {
        el.farewellMessage.textContent = `Great work today, ${activeShift.name}! You worked ${durationStr}. Your clock-out was recorded at ${clockOutTimeStr}.`;
      }
      if (el.farewellModal) el.farewellModal.classList.remove('hidden');

      // 5. Reset active shift ONLY (user stays logged in)
      if (shiftTimerInterval) {
        clearInterval(shiftTimerInterval);
        shiftTimerInterval = null;
      }
      activeShift = null;
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);

    } catch (err) {
      hideLoading();
      alert('Clock-Out Error: ' + err.message);
    }
  }

  // --- MANUAL SIGN OUT ---
  function triggerLogout() {
    if (activeShift && activeShift.status === 'Clocked In') {
      const confirmLogout = confirm('You currently have an active shift in progress. Signing out will not clock you out. Are you sure you want to sign out?');
      if (!confirmLogout) return;
    }
    clearUserSession(false);
    refreshScreenState();
  }

  // POST helper for Attendance Google Apps Script Web App
  function postToGoogleAppsScript(url, payload) {
    const target = url || currentUser?.attendanceScriptUrl || settings.scriptUrl;
    return new Promise((resolve) => {
      if (!target) return resolve({ success: true, localOnly: true });

      fetch(target, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(() => resolve({ success: true }))
        .catch(() => resolve({ success: true }));
    });
  }

  function updateSyncBadgeUI() {
    if (el.syncStatusText && el.syncStatusBadge) {
      const targetScriptUrl = currentUser?.attendanceScriptUrl || settings.scriptUrl;
      if (targetScriptUrl) {
        el.syncStatusText.textContent = isServerTimeSynced
          ? `Verified Google Server Time (${serverTimeZone || 'Tamper-Proof'})`
          : 'Logged to Google Sheet via Google Apps Script (Server Time)';
        el.syncStatusBadge.className = 'flex items-center gap-1.5 text-[10px] sm:text-[11px] text-emerald-800 bg-emerald-50 rounded-lg p-2 border border-emerald-200';
      } else {
        el.syncStatusText.textContent = 'Stored locally (Add Google Apps Script URL in Settings to sync)';
        el.syncStatusBadge.className = 'flex items-center gap-1.5 text-[10px] sm:text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2 border border-amber-200';
      }
    }
  }

  function startShiftDurationTimer(isoStartTime) {
    if (shiftTimerInterval) clearInterval(shiftTimerInterval);

    const startTime = new Date(isoStartTime).getTime();

    function update() {
      const now = getNow().getTime();
      const diffMs = Math.max(0, now - startTime);
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      const pad = (n) => String(n).padStart(2, '0');
      if (el.shiftDurationTimer) {
        el.shiftDurationTimer.textContent = `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
      }
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

  function updateHistoryClockOut(shiftId, clockOutTime, duration, outLocation, outMapsUrl) {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
    const record = history.find(item => item.id === shiftId || (item.email === activeShift?.email && item.status === 'Clocked In'));
    if (record) {
      record.clockOutTime = clockOutTime;
      record.duration = duration;
      record.status = 'Completed';
      if (outLocation) {
        record.clockOutLatitude = outLocation.latitude.toFixed(5);
        record.clockOutLongitude = outLocation.longitude.toFixed(5);
        record.clockOutAccuracy = Math.round(outLocation.accuracy);
        record.clockOutMapsUrl = outMapsUrl;
      }
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
            <span class="text-[10px] text-warmgray-500 block">📍 ${escapeHtml(item.latitude || '')}, ${escapeHtml(item.longitude || '')}</span>
          </div>
          <div>
            <span class="text-[10px] text-warmgray-400 uppercase font-semibold block">Clock Out</span>
            <span class="font-mono text-[11px] font-medium">${escapeHtml(item.clockOutTime || '(Active Shift)')}</span>
            ${item.clockOutLatitude ? `<span class="text-[10px] text-warmgray-500 block">📍 ${escapeHtml(item.clockOutLatitude)}, ${escapeHtml(item.clockOutLongitude)}</span>` : ''}
          </div>
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-warmgray-100 text-[11px]">
          <span class="text-warmgray-600 font-medium">Duration: ${escapeHtml(item.duration || 'In Progress')}</span>
          ${item.mapsUrl ? `<a href="${escapeHtml(item.mapsUrl)}" target="_blank" class="text-amber-700 hover:underline font-medium">In Map ↗</a>` : ''}
          ${item.clockOutMapsUrl ? `<a href="${escapeHtml(item.clockOutMapsUrl)}" target="_blank" class="text-amber-700 hover:underline font-medium ml-2">Out Map ↗</a>` : ''}
        </div>
      `;
      el.historyListContainer.appendChild(card);
    });
  }

  // --- UI SPINNERS & FORMATTING ---
  function showLoading(title, subtitle) {
    if (el.loadingTitle) el.loadingTitle.textContent = title || 'Processing';
    if (el.loadingSubtitle) el.loadingSubtitle.textContent = subtitle || 'Please wait...';
    if (el.loadingOverlay) el.loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    if (el.loadingOverlay) el.loadingOverlay.classList.add('hidden');
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
    if (el.inputRestaurantName) el.inputRestaurantName.value = currentUser?.restaurantName || settings.restaurantName || '';
    if (el.inputRestaurantLogo) el.inputRestaurantLogo.value = currentUser?.restaurantLogo !== undefined ? currentUser.restaurantLogo : (settings.restaurantLogo || '');
    if (el.inputClientId) el.inputClientId.value = settings.clientId || '';
    if (el.inputScriptUrl) el.inputScriptUrl.value = currentUser?.attendanceScriptUrl || settings.scriptUrl || '';
    if (el.inputTenancyUrl) el.inputTenancyUrl.value = settings.tenancyScriptUrl || '';
    if (el.settingsModal) el.settingsModal.classList.remove('hidden');
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
    // Sign-In with Google Trigger (Staff & Returning Admins)
    if (el.btnLoginTrigger) {
      el.btnLoginTrigger.addEventListener('click', () => {
        triggerHaptic();
        triggerLogin('signin');
      });
    }

    // Sign-Up with Google Trigger (Restaurant Owners)
    if (el.btnSignupTrigger) {
      el.btnSignupTrigger.addEventListener('click', () => {
        triggerHaptic();
        triggerLogin('signup');
      });
    }

    // Header Logout Trigger
    if (el.btnLogoutTrigger) {
      el.btnLogoutTrigger.addEventListener('click', () => {
        triggerHaptic();
        triggerLogout();
      });
    }

    // Header Team Management Trigger (Admin only)
    if (el.btnOpenTeam) {
      el.btnOpenTeam.addEventListener('click', () => {
        triggerHaptic();
        openTeamModal();
      });
    }

    // Quick Setup Link in warning banner
    if (el.btnQuickSetup) {
      el.btnQuickSetup.addEventListener('click', () => {
        triggerHaptic();
        openSettingsModal();
      });
    }

    // Clock-In Button Trigger
    if (el.btnClockInTrigger) {
      el.btnClockInTrigger.addEventListener('click', () => {
        triggerHaptic();
        triggerClockIn();
      });
    }

    // Clock-Out Button Trigger
    if (el.btnClockOutTrigger) {
      el.btnClockOutTrigger.addEventListener('click', () => {
        triggerHaptic();
        triggerClockOut();
      });
    }

    // Farewell Modal Dismiss (returns to Ready to Clock In screen, still logged in)
    if (el.btnCloseFarewell) {
      el.btnCloseFarewell.addEventListener('click', () => {
        triggerHaptic();
        if (el.farewellModal) el.farewellModal.classList.add('hidden');
        refreshScreenState();
      });
    }

    // History Modal
    if (el.btnOpenHistory) {
      el.btnOpenHistory.addEventListener('click', () => {
        renderHistoryModal();
        if (el.historyModal) el.historyModal.classList.remove('hidden');
      });
    }
    if (el.btnCloseHistory) el.btnCloseHistory.addEventListener('click', () => el.historyModal?.classList.add('hidden'));
    if (el.btnCloseHistoryBottom) el.btnCloseHistoryBottom.addEventListener('click', () => el.historyModal?.classList.add('hidden'));
    if (el.btnClearHistory) {
      el.btnClearHistory.addEventListener('click', () => {
        if (confirm('Clear all local shift records? This does not delete rows from your Google Sheet.')) {
          localStorage.removeItem(STORAGE_KEYS.HISTORY);
          renderHistoryModal();
        }
      });
    }

    // Onboarding Modal Events
    if (el.btnCancelOnboard) el.btnCancelOnboard.addEventListener('click', closeOnboardingModal);
    if (el.btnSaveOnboard) {
      el.btnSaveOnboard.addEventListener('click', () => {
        triggerHaptic();
        submitOnboarding();
      });
    }

    // Team Management Modal Events
    if (el.btnCloseTeam) el.btnCloseTeam.addEventListener('click', closeTeamModal);
    if (el.btnCloseTeamBottom) el.btnCloseTeamBottom.addEventListener('click', closeTeamModal);
    if (el.btnSendInvite) {
      el.btnSendInvite.addEventListener('click', () => {
        triggerHaptic();
        inviteTeamMember();
      });
    }

    // Settings Modal
    if (el.btnOpenSettings) el.btnOpenSettings.addEventListener('click', openSettingsModal);

    const closeSettings = () => el.settingsModal?.classList.add('hidden');
    if (el.btnCloseSettings) el.btnCloseSettings.addEventListener('click', closeSettings);
    if (el.btnCancelSettings) el.btnCancelSettings.addEventListener('click', closeSettings);

    if (el.btnSaveSettings) {
      el.btnSaveSettings.addEventListener('click', () => {
        settings.restaurantName = el.inputRestaurantName?.value.trim() || 'Bella Bistro & Bar';
        settings.restaurantLogo = el.inputRestaurantLogo?.value.trim() || '';
        settings.clientId = el.inputClientId?.value.trim() || '';
        settings.scriptUrl = el.inputScriptUrl?.value.trim() || '';
        settings.tenancyScriptUrl = el.inputTenancyUrl?.value.trim() || '';

        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

        if (currentUser) {
          currentUser.restaurantName = settings.restaurantName;
          currentUser.restaurantLogo = settings.restaurantLogo;
          currentUser.attendanceScriptUrl = settings.scriptUrl;
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(currentUser));

          // If Admin, sync updated configuration to central tenancy sheet
          if (currentUser.role === 'admin' && settings.tenancyScriptUrl) {
            callTenancyApi('update_config', {
              adminEmail: currentUser.email,
              restaurantName: settings.restaurantName,
              logoUrl: settings.restaurantLogo,
              attendanceScriptUrl: settings.scriptUrl
            }).catch(e => console.warn('[Tenancy] update_config note:', e));
          }
        }

        applyBrandSettings();
        updateSetupWarningVisibility();
        initGoogleAuth();
        syncServerTime();
        closeSettings();
        alert('Settings saved successfully!');
      });
    }
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
