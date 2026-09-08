/**
 * SheetPunch - Authentication & Session Management
 */
window.SheetPunch = window.SheetPunch || window.CrewClock || {};
window.CrewClock = window.SheetPunch;

(function (exports) {
  'use strict';

  const STORAGE_KEYS = exports.STORAGE_KEYS || window.STORAGE_KEYS || {
    SETTINGS: 'sheetpunch_settings_v3',
    SESSION: 'sheetpunch_user_session',
    ACTIVE_SHIFT: 'clockin_active_shift',
    HISTORY: 'clockin_history',
    PUNCH_QUEUE: 'sheetpunch_punch_queue'
  };

  const SESSION_DURATION_MS = exports.SESSION_DURATION_MS || 7 * 24 * 60 * 60 * 1000;

  // --- USER SESSION MANAGEMENT ---
  function getUserSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSION) || localStorage.getItem('crewclock_user_session');
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.email) return null;

      // Check session expiry
      if (session.expiresAt && Date.now() > session.expiresAt) {
        console.log('[Session] User session has expired.');
        clearUserSession(true);
        return null;
      }
      if (session.accessToken && (!session.tokenExpiresAt || Date.now() < session.tokenExpiresAt)) {
        if (exports.state) exports.state.currentAccessToken = session.accessToken;
      }
      if (exports.state) exports.state.currentUser = session;
      return session;
    } catch (e) {
      console.warn('[Session] Error reading user session:', e);
      return null;
    }
  }

  function saveUserSession(user) {
    const settings = exports.state?.settings || {};
    const session = {
      email: user.email,
      name: user.name,
      picture: user.picture || '',
      role: user.role || 'employee',
      tenantId: user.tenantId || '',
      businessName: user.businessName || user.restaurantName || settings.businessName || settings.restaurantName,
      restaurantName: user.businessName || user.restaurantName || settings.businessName || settings.restaurantName,
      businessType: user.businessType || settings.businessType || 'General Business',
      businessLogo: user.businessLogo !== undefined ? user.businessLogo : (user.restaurantLogo !== undefined ? user.restaurantLogo : settings.businessLogo),
      restaurantLogo: user.businessLogo !== undefined ? user.businessLogo : (user.restaurantLogo !== undefined ? user.restaurantLogo : settings.restaurantLogo),
      attendanceScriptUrl: user.attendanceScriptUrl || settings.scriptUrl,
      timeZone: user.timeZone || 'America/Los_Angeles',
      subscription: user.subscription || (exports.state?.currentUser?.subscription ? exports.state.currentUser.subscription : {
        status: 'trial',
        plan: 'Free Trial',
        billingCycle: 'trial',
        isTrial: true,
        isPaid: false,
        isValid: true,
        daysRemaining: 14,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        subscriptionEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        paidAmount: '$0.00',
        paymentRef: 'TRIAL_SIGNUP'
      }),
      accessToken: user.accessToken || exports.state?.currentAccessToken || '',
      tokenExpiresAt: user.tokenExpiresAt || (exports.state?.currentAccessToken ? Date.now() + 3500 * 1000 : 0),
      loginTime: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION_MS
    };

    if (exports.state) {
      exports.state.currentUser = session;
      if (session.accessToken) {
        exports.state.currentAccessToken = session.accessToken;
      }
    }

    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));

    if (typeof exports.applyBrandSettings === 'function') exports.applyBrandSettings();
    updateHeaderUserUI();
    updateRoleBasedUI();
    return session;
  }

  function clearUserSession(isExpired) {
    if (exports.state) {
      exports.state.currentUser = null;
      exports.state.currentAccessToken = null;
    }
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem('crewclock_user_session');

    if (typeof exports.applyBrandSettings === 'function') exports.applyBrandSettings();
    updateHeaderUserUI();
    updateRoleBasedUI();

    const el = exports.dom?.el || window.el || {};
    if (isExpired && el.sessionExpiredAlert) {
      el.sessionExpiredAlert.classList.remove('hidden');
    }
  }

  function updateHeaderUserUI() {
    const el = exports.dom?.el || window.el || {};
    if (!el.headerUserBadge) return;
    const currentUser = exports.state?.currentUser;

    if (currentUser && currentUser.email) {
      if (el.headerUserName) {
        const firstName = (currentUser.name || 'User').split(' ')[0];
        el.headerUserName.textContent = firstName;
      }
      const initials = (currentUser.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      if (el.headerUserInitials) el.headerUserInitials.textContent = initials;

      if (currentUser.picture) {
        if (el.headerUserInitials) el.headerUserInitials.classList.add('hidden');
        if (el.headerUserImg) {
          el.headerUserImg.onerror = () => {
            el.headerUserImg.classList.add('hidden');
            if (el.headerUserInitials) el.headerUserInitials.classList.remove('hidden');
          };
          el.headerUserImg.src = currentUser.picture;
          el.headerUserImg.classList.remove('hidden');
        }
      } else {
        if (el.headerUserImg) el.headerUserImg.classList.add('hidden');
        if (el.headerUserInitials) el.headerUserInitials.classList.remove('hidden');
      }

      // Subscription / Free Trial Pill (Admin only - billing managed by Admin)
      if (el.headerPlanPill) {
        const isAdmin = currentUser && currentUser.role === 'admin';
        const sub = currentUser.subscription;
        if (isAdmin && sub) {
          if (sub.status === 'past_due') {
            el.headerPlanPill.textContent = 'Past Due';
            el.headerPlanPill.className = 'hidden xl:inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-rose-100 text-rose-800 border border-rose-200 animate-pulse';
            el.headerPlanPill.classList.remove('hidden');
          } else if (sub.isPaid && sub.isValid) {
            const displayPlan = sub.plan ? (sub.plan.includes('(') ? sub.plan.split('(')[0].trim() : sub.plan) : 'Active Plan';
            el.headerPlanPill.textContent = displayPlan;
            el.headerPlanPill.className = 'hidden xl:inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-emerald-100 text-emerald-800 border border-emerald-200';
            el.headerPlanPill.classList.remove('hidden');
          } else if (sub.isTrial && sub.isValid) {
            const days = typeof sub.daysRemaining === 'number' ? sub.daysRemaining : 14;
            el.headerPlanPill.textContent = `${days}d Trial`;
            el.headerPlanPill.className = 'hidden xl:inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-100 text-amber-800 border border-amber-200';
            el.headerPlanPill.classList.remove('hidden');
          } else {
            el.headerPlanPill.textContent = 'Expired';
            el.headerPlanPill.className = 'hidden xl:inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-rose-100 text-rose-800 border border-rose-200';
            el.headerPlanPill.classList.remove('hidden');
          }
        } else {
          el.headerPlanPill.textContent = '';
          el.headerPlanPill.className = 'hidden';
        }
      }

      el.headerUserBadge.classList.remove('hidden');
    } else {
      el.headerUserBadge.classList.add('hidden');
      if (el.headerPlanPill) {
        el.headerPlanPill.textContent = '';
        el.headerPlanPill.className = 'hidden';
      }
      if (el.headerRolePill) {
        el.headerRolePill.textContent = '';
        el.headerRolePill.className = 'hidden';
      }
    }
  }

  // --- ROLE-BASED ACCESS CONTROL (RBAC) UI ---
  function updateRoleBasedUI() {
    const el = exports.dom?.el || window.el || {};
    const currentUser = exports.state?.currentUser;
    const isMobileApp = exports.isNativeMobileApp ? exports.isNativeMobileApp() : false;
    const isAdmin = currentUser && currentUser.role === 'admin';
    const isDesktopWebApp = !isMobileApp && window.innerWidth >= 768;
    const hasSession = !!getUserSession();

    // Mark body if native mobile app container (iOS/Android)
    if (isMobileApp) {
      document.body.classList.add('is-native-app');
    } else {
      document.body.classList.remove('is-native-app');
    }

    // Header role pill (desktop only: Admin vs Staff)
    if (el.headerRolePill) {
      if (isAdmin) {
        el.headerRolePill.textContent = 'Admin';
        el.headerRolePill.className = 'hidden xl:inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-100 text-amber-800 border border-amber-300';
        el.headerRolePill.classList.remove('hidden');
      } else if (currentUser && (currentUser.role === 'employee' || !isAdmin)) {
        el.headerRolePill.textContent = 'Staff';
        el.headerRolePill.className = 'hidden xl:inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-warmgray-100 text-warmgray-700 border border-warmgray-200';
        el.headerRolePill.classList.remove('hidden');
      } else {
        el.headerRolePill.textContent = '';
        el.headerRolePill.className = 'hidden';
      }
    }

    // Desktop Top Navigation Buttons
    if (el.headerDesktopNav) {
      if (hasSession && !isMobileApp) {
        el.headerDesktopNav.classList.remove('hidden');
      } else {
        el.headerDesktopNav.classList.add('hidden');
      }
    }

    // Desktop button permissions
    if (el.btnOpenHistory) {
      if (hasSession) el.btnOpenHistory.classList.remove('hidden');
      else el.btnOpenHistory.classList.add('hidden');
    }
    if (el.btnOpenTeam) {
      if (isAdmin) el.btnOpenTeam.classList.remove('hidden');
      else el.btnOpenTeam.classList.add('hidden');
    }
    if (el.btnOpenBilling) {
      if (isAdmin && isDesktopWebApp) el.btnOpenBilling.classList.remove('hidden');
      else el.btnOpenBilling.classList.add('hidden');
    }
    if (el.btnOpenSettings) {
      if (isAdmin) el.btnOpenSettings.classList.remove('hidden');
      else el.btnOpenSettings.classList.add('hidden');
    }

    // Mobile Bottom Navigation Dock
    if (el.mobileBottomNav) {
      if (hasSession) {
        el.mobileBottomNav.classList.remove('hidden');
      } else {
        el.mobileBottomNav.classList.add('hidden');
      }
    }

    // Mobile Bottom Navigation Tabs
    if (el.mobileNavClock) el.mobileNavClock.classList.remove('hidden');
    if (el.mobileNavHistory) el.mobileNavHistory.classList.remove('hidden');

    if (el.mobileNavTeam) {
      if (isAdmin) el.mobileNavTeam.classList.remove('hidden');
      else el.mobileNavTeam.classList.add('hidden');
    }

    if (el.mobileNavBilling) {
      if (isAdmin && hasSession) el.mobileNavBilling.classList.remove('hidden');
      else el.mobileNavBilling.classList.add('hidden');
    }

    if (el.mobileNavSettings) {
      if (isAdmin) el.mobileNavSettings.classList.remove('hidden');
      else el.mobileNavSettings.classList.add('hidden');
    }

    if (el.settingsBillingSection) {
      if (isAdmin && hasSession) {
        el.settingsBillingSection.classList.remove('hidden');
      } else {
        el.settingsBillingSection.classList.add('hidden');
      }
    }

    if (el.btnSettingsUpgrade) {
      if (isAdmin && hasSession) {
        el.btnSettingsUpgrade.classList.remove('hidden');
      } else {
        el.btnSettingsUpgrade.classList.add('hidden');
      }
    }
    if (el.settingsMobileSubNote) {
      el.settingsMobileSubNote.classList.add('hidden');
    }
  }

  // --- GOOGLE IDENTITY SERVICES (GIS) AUTHENTICATION ---
  function initGoogleAuth() {
    const settings = exports.state?.settings || {};
    if (window.google && window.google.accounts && window.google.accounts.oauth2 && settings.clientId) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: settings.clientId.trim(),
          scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          prompt: 'select_account',
          callback: handleGoogleAuthResponse
        });
        if (exports.state) exports.state.tokenClient = client;
      } catch (err) {
        console.warn('Google OAuth Token Client initialization error:', err);
      }
    }
  }

  async function getValidAccessToken(forcePrompt = false) {
    if (!forcePrompt && exports.state?.currentAccessToken) {
      const expiresAt = exports.state.currentUser?.tokenExpiresAt || 0;
      if (expiresAt === 0 || Date.now() < expiresAt - 60000) {
        return exports.state.currentAccessToken;
      }
    }

    if (!exports.state?.tokenClient) initGoogleAuth();
    const tokenClient = exports.state?.tokenClient;
    if (!tokenClient) {
      throw new Error('Google OAuth client is not configured. Please enter your Google Client ID in Settings.');
    }

    return new Promise((resolve, reject) => {
      let resolved = false;
      const prevCallback = tokenClient.callback;

      tokenClient.callback = (resp) => {
        tokenClient.callback = prevCallback || handleGoogleAuthResponse;
        resolved = true;
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error || 'Failed to acquire Google access token.'));
          return;
        }
        if (exports.state) exports.state.currentAccessToken = resp.access_token;
        const expiresAt = Date.now() + (resp.expires_in ? Number(resp.expires_in) * 1000 : 3500 * 1000);
        if (exports.state?.currentUser) {
          exports.state.currentUser.accessToken = resp.access_token;
          exports.state.currentUser.tokenExpiresAt = expiresAt;
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(exports.state.currentUser));
        }
        resolve(resp.access_token);
      };

      try {
        tokenClient.requestAccessToken({ prompt: forcePrompt ? 'select_account' : '' });
      } catch (err) {
        tokenClient.callback = prevCallback || handleGoogleAuthResponse;
        reject(err);
      }

      setTimeout(() => {
        if (!resolved) {
          tokenClient.callback = prevCallback || handleGoogleAuthResponse;
          reject(new Error('Google access token request timed out. Please sign in again.'));
        }
      }, 15000);
    });
  }

  async function ensureValidAccessToken() {
    try {
      return await getValidAccessToken(false);
    } catch (err) {
      console.log('Silent token refresh failed, requesting user interaction:', err);
      return await getValidAccessToken(true);
    }
  }

  async function handleGoogleAuthResponse(tokenResponse) {
    const showLoading = exports.dom?.showLoading || window.showLoading || function () {};
    const hideLoading = exports.dom?.hideLoading || window.hideLoading || function () {};
    const el = exports.dom?.el || window.el || {};
    const settings = exports.state?.settings || {};

    if (tokenResponse.error) {
      hideLoading();
      alert('Google Sign-In Error: ' + tokenResponse.error);
      return;
    }

    if (exports.state) exports.state.currentAccessToken = tokenResponse.access_token;
    const tokenExpiresAt = Date.now() + (tokenResponse.expires_in ? Number(tokenResponse.expires_in) * 1000 : 3500 * 1000);

    // Notify Android native wrapper to dismiss any open OAuth dialog
    try {
      if (window.AndroidBridge && typeof window.AndroidBridge.onAuthSuccess === 'function') {
        window.AndroidBridge.onAuthSuccess();
      }
    } catch (bridgeErr) {
      console.log('AndroidBridge call:', bridgeErr);
    }

    try {
      showLoading('Verifying Google Account', 'Checking authenticated Google credentials...');
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
          const callTenancyApi = exports.callTenancyApi || window.callTenancyApi;
          const tenancyRes = await callTenancyApi('check_user', { email: email });

          // SCENARIO 1: SIGN IN FLOW
          if (exports.state?.authMode === 'signin') {
            if (tenancyRes.exists && tenancyRes.user) {
              const userRole = tenancyRes.user.role || 'employee';
              const tenant = tenancyRes.tenant || {};

              saveUserSession({
                email: email,
                name: name,
                picture: picture,
                role: userRole,
                tenantId: tenancyRes.user.tenantId,
                businessName: tenant.businessName || tenant.restaurantName || settings.businessName,
                restaurantName: tenant.businessName || tenant.restaurantName || settings.businessName,
                businessType: tenant.businessType || settings.businessType || 'General Business',
                businessLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : settings.businessLogo,
                restaurantLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : settings.restaurantLogo,
                attendanceScriptUrl: tenant.attendanceSheetId || tenant.attendanceScriptUrl || settings.scriptUrl,
                timeZone: tenant.timeZone || 'America/Los_Angeles',
                subscription: tenancyRes.subscription || tenant.subscription,
                accessToken: tokenResponse.access_token,
                tokenExpiresAt: tokenExpiresAt
              });

              if (el.sessionExpiredAlert) el.sessionExpiredAlert.classList.add('hidden');
              if (el.uninvitedUserAlert) el.uninvitedUserAlert.classList.add('hidden');
              hideLoading();
              if (typeof exports.syncServerTime === 'function') exports.syncServerTime();
              if (typeof exports.refreshScreenState === 'function') exports.refreshScreenState();
              return;
            } else {
              hideLoading();
              if (el.uninvitedUserText) {
                el.uninvitedUserText.textContent = `Account "${email}" is not registered in any business workspace. Please ask your business manager to invite this Google account, or sign up as a business owner below.`;
              }
              if (el.uninvitedUserAlert) el.uninvitedUserAlert.classList.remove('hidden');
              return;
            }

          // SCENARIO 2: SIGN UP FLOW
          } else if (exports.state?.authMode === 'signup') {
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
                  businessName: tenant.businessName || tenant.restaurantName || settings.businessName,
                  restaurantName: tenant.businessName || tenant.restaurantName || settings.businessName,
                  businessType: tenant.businessType || settings.businessType || 'General Business',
                  businessLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : settings.businessLogo,
                  restaurantLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : settings.restaurantLogo,
                  attendanceScriptUrl: tenant.attendanceSheetId || tenant.attendanceScriptUrl || settings.scriptUrl,
                  timeZone: tenant.timeZone || 'America/Los_Angeles',
                  subscription: tenancyRes.subscription || tenant.subscription,
                  accessToken: tokenResponse.access_token,
                  tokenExpiresAt: tokenExpiresAt
                });
                if (typeof exports.syncServerTime === 'function') exports.syncServerTime();
                if (typeof exports.refreshScreenState === 'function') exports.refreshScreenState();
                alert(`Welcome back, ${name}!\nYou are already registered as Admin for "${tenant.businessName || tenant.restaurantName || 'your business'}".`);
              } else {
                alert(`Account "${email}" is already registered as an employee at "${tenancyRes.tenant?.businessName || tenancyRes.tenant?.restaurantName || 'a business'}". Please use "Sign In with Google" instead.`);
              }
              return;
            }

            // New Admin -> Open Onboarding Modal to capture Business details
            hideLoading();
            if (exports.state) exports.state.pendingAdminProfile = { email: email, name: name, picture: picture };
            if (typeof exports.openOnboardingModal === 'function') exports.openOnboardingModal();
            return;
          }
        } catch (dirErr) {
          hideLoading();
          alert('Could not verify account with Tenants Directory: ' + dirErr.message);
          return;
        }
      }

      // STANDALONE SINGLE-TENANT FALLBACK
      const user = {
        email: email,
        name: name,
        picture: picture,
        role: 'admin',
        businessName: settings.businessName,
        restaurantName: settings.restaurantName,
        businessType: settings.businessType,
        businessLogo: settings.businessLogo,
        restaurantLogo: settings.restaurantLogo,
        attendanceScriptUrl: settings.scriptUrl,
        accessToken: tokenResponse.access_token,
        tokenExpiresAt: tokenExpiresAt
      };

      saveUserSession(user);
      if (el.sessionExpiredAlert) el.sessionExpiredAlert.classList.add('hidden');
      if (el.uninvitedUserAlert) el.uninvitedUserAlert.classList.add('hidden');
      hideLoading();
      if (typeof exports.syncServerTime === 'function') exports.syncServerTime();
      if (typeof exports.refreshScreenState === 'function') exports.refreshScreenState();

    } catch (err) {
      hideLoading();
      alert('Sign-In Verification Error: ' + err.message);
    }
  }

  // Trigger Google Login or Signup
  function triggerLogin(mode = 'signin') {
    if (exports.state) exports.state.authMode = mode;
    const el = exports.dom?.el || window.el || {};
    const settings = exports.state?.settings || window.settings || {};
    const showLoading = exports.dom?.showLoading || window.showLoading || function () {};
    const openSettingsModal = exports.openSettingsModal || window.openSettingsModal || function () {};
    let tokenClient = exports.state?.tokenClient || window.tokenClient;

    if (el.uninvitedUserAlert) el.uninvitedUserAlert.classList.add('hidden');

    if (settings.clientId && settings.clientId.trim().length > 0) {
      if (!tokenClient) {
        initGoogleAuth();
        tokenClient = exports.state?.tokenClient || window.tokenClient;
      }
      showLoading(
        'Connecting to Google',
        mode === 'signup'
          ? 'Opening Google Account chooser for Business Signup...'
          : 'Opening Google Sign-In account chooser...'
      );
      if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'select_account' });
      }
    } else {
      alert('Google Sign-In Required:\n\nPlease enter your Google OAuth Client ID in Settings (or in config.js) to enable Google authentication.');
      openSettingsModal();
    }
  }

  // --- MANUAL SIGN OUT ---
  async function triggerLogout() {
    const showConfirmDialog = exports.dom?.showConfirmDialog || window.showConfirmDialog;
    const activeShift = exports.state?.activeShift;

    if (activeShift && activeShift.status === 'Clocked In') {
      const confirmed = await showConfirmDialog({
        title: 'Active Shift in Progress',
        message: 'You currently have an active shift in progress.\n\nSigning out will NOT clock you out. Are you sure you want to sign out?',
        confirmText: 'Sign Out Anyway',
        cancelText: 'Stay Signed In',
        type: 'rose'
      });
      if (!confirmed) return;
    }
    clearUserSession(false);
    if (typeof exports.refreshScreenState === 'function') exports.refreshScreenState();
  }

  // Exports
  exports.getUserSession = getUserSession;
  exports.saveUserSession = saveUserSession;
  exports.clearUserSession = clearUserSession;
  exports.updateHeaderUserUI = updateHeaderUserUI;
  exports.updateRoleBasedUI = updateRoleBasedUI;
  exports.initGoogleAuth = initGoogleAuth;
  exports.getValidAccessToken = getValidAccessToken;
  exports.ensureValidAccessToken = ensureValidAccessToken;
  exports.handleGoogleAuthResponse = handleGoogleAuthResponse;
  exports.triggerLogin = triggerLogin;
  exports.triggerLogout = triggerLogout;

  // Global fallbacks
  window.getUserSession = getUserSession;
  window.saveUserSession = saveUserSession;
  window.clearUserSession = clearUserSession;
  window.updateRoleBasedUI = updateRoleBasedUI;
  window.triggerLogin = triggerLogin;
  window.triggerLogout = triggerLogout;

})(window.SheetPunch);
