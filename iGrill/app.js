/**
 * Small & Medium Business Employee Clock-In & Attendance Web App
 * Features:
 * - Google Sign-In authentication with multi-tenant directory routing
 * - Onboarding flow for Business Owners (creates workspace + Admin role)
 * - 14-Day Free Trial model synced to central Google Sheet
 * - Mobile bottom navigation dock & desktop top navigation bar
 * - Real-time GPS verification with tamper-proof Google Sheet sync
 */

(() => {
  'use strict';

  // --- LOCAL STORAGE KEYS ---
  const STORAGE_KEYS = {
    SETTINGS: 'crewclock_settings_v3',
    SESSION: 'crewclock_user_session',
    ACTIVE_SHIFT: 'clockin_active_shift',
    HISTORY: 'clockin_history'
  };

  // Default Session Duration: 7 days
  const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

  // Base configuration loaded from config.js
  const fileConfig = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG : {};

  // Default Settings merging config.js and localStorage
  const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
  const defaultOrgName = fileConfig.organizationName || fileConfig.businessName || fileConfig.restaurantName || 'Lightning Ventures LLC';
  let settings = {
    businessName: savedSettings.businessName || savedSettings.restaurantName || defaultOrgName,
    restaurantName: savedSettings.businessName || savedSettings.restaurantName || defaultOrgName,
    businessType: savedSettings.businessType || 'Small & Medium Business',
    businessLogo: savedSettings.businessLogo || savedSettings.restaurantLogo || fileConfig.organizationLogo || fileConfig.businessLogo || fileConfig.restaurantLogo || '',
    restaurantLogo: savedSettings.businessLogo || savedSettings.restaurantLogo || fileConfig.organizationLogo || fileConfig.businessLogo || fileConfig.restaurantLogo || '',
    // Code-driven platform parameters (common to all tenants, cannot be modified by tenant admins):
    clientId: (fileConfig.googleClientId || '').trim(),
    tenancyScriptUrl: (fileConfig.tenancyScriptUrl || '').trim(),
    // Tenant attendance target:
    scriptUrl: savedSettings.scriptUrl || fileConfig.googleScriptUrl || ''
  };

  // Runtime State
  let currentUser = null;
  let activeShift = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFT) || 'null');
  let tokenClient = null;
  let currentAccessToken = null;
  let shiftTimerInterval = null;
  let platformServiceEmail = '';

  // Standard Attendance Sheet Columns (11 columns)
  const SHEET_HEADERS = [
    'Date',
    'Employee Name',
    'Email',
    'Clock In Time',
    'Clock In Coordinates',
    'Clock In Map',
    'Clock Out Time',
    'Shift Duration',
    'Clock Out Coordinates',
    'Clock Out Map',
    'Status'
  ];

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
    headerPlanPill: document.getElementById('header-plan-pill'),
    btnLogoutTrigger: document.getElementById('btn-logout-trigger'),
    btnOpenTeam: document.getElementById('btn-open-team'),
    btnOpenBilling: document.getElementById('btn-open-billing'),
    btnOpenHistory: document.getElementById('btn-open-history'),
    btnOpenSettings: document.getElementById('btn-open-settings'),
    headerDesktopNav: document.getElementById('header-desktop-nav'),

    // Mobile Bottom Navigation Dock
    mobileBottomNav: document.getElementById('mobile-bottom-nav'),
    mobileNavClock: document.getElementById('mobile-nav-clock'),
    mobileNavHistory: document.getElementById('mobile-nav-history'),
    mobileNavTeam: document.getElementById('mobile-nav-team'),
    mobileNavBilling: document.getElementById('mobile-nav-billing'),
    mobileNavSettings: document.getElementById('mobile-nav-settings'),

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
    readyRoleBadge: document.getElementById('ready-role-badge'),
    readyPlanBadge: document.getElementById('ready-plan-badge'),
    readyScreenGreeting: document.getElementById('ready-screen-greeting'),
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
    inputSettingsBusinessType: document.getElementById('input-settings-business-type'),
    btnToggleSettingsBusinessType: document.getElementById('btn-toggle-settings-business-type'),
    listSettingsBusinessType: document.getElementById('list-settings-business-type'),
    arrowSettingsBusinessType: document.getElementById('arrow-settings-business-type'),
    inputRestaurantLogo: document.getElementById('input-restaurant-logo'),
    inputScriptUrl: document.getElementById('input-sheet-id'),
    inputSettingsTimezone: document.getElementById('input-settings-timezone'),
    settingsBillingSection: document.getElementById('settings-billing-section'),
    settingsSubBadge: document.getElementById('settings-sub-badge'),
    settingsSubPlan: document.getElementById('settings-sub-plan'),
    settingsSubExpiry: document.getElementById('settings-sub-expiry'),
    btnSettingsUpgrade: document.getElementById('btn-settings-upgrade'),
    settingsMobileSubNote: document.getElementById('settings-mobile-sub-note'),

    historyModal: document.getElementById('history-modal'),
    btnCloseHistory: document.getElementById('btn-close-history'),
    btnCloseHistoryBottom: document.getElementById('btn-close-history-bottom'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    historyListContainer: document.getElementById('history-list-container'),

    // Onboarding Modal (Business Owner Signup)
    onboardingModal: document.getElementById('onboarding-modal'),
    onboardTrialDesc: document.getElementById('onboard-trial-desc'),
    inputOnboardName: document.getElementById('input-onboard-name'),
    inputOnboardBusinessType: document.getElementById('input-onboard-business-type'),
    btnToggleOnboardBusinessType: document.getElementById('btn-toggle-onboard-business-type'),
    listOnboardBusinessType: document.getElementById('list-onboard-business-type'),
    arrowOnboardBusinessType: document.getElementById('arrow-onboard-business-type'),
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

    // Billing Modal (Web App Only)
    billingModal: document.getElementById('billing-modal'),
    btnCloseBilling: document.getElementById('btn-close-billing'),
    billingStatusBanner: document.getElementById('billing-current-status-banner'),
    billingStatusTitle: document.getElementById('billing-status-title'),
    billingStatusDesc: document.getElementById('billing-status-desc'),
    billingStatusChip: document.getElementById('billing-status-chip'),
    billingCheckoutContainer: document.getElementById('billing-checkout-container'),
    billingPlatformNotice: document.getElementById('billing-platform-notice'),
    billingPlatformIcon: document.getElementById('billing-platform-icon'),
    billingPlatformTitle: document.getElementById('billing-platform-title'),
    billingPlatformBadge: document.getElementById('billing-platform-badge'),
    billingPlatformDesc: document.getElementById('billing-platform-desc'),
    btnCycleMonthly: document.getElementById('btn-cycle-monthly'),
    btnCycleYearly: document.getElementById('btn-cycle-yearly'),
    planCardStarter: document.getElementById('plan-card-starter'),
    planCardGrowth: document.getElementById('plan-card-growth'),
    planCardScale: document.getElementById('plan-card-scale'),
    planCheckStarter: document.getElementById('plan-check-starter'),
    planCheckGrowth: document.getElementById('plan-check-growth'),
    planCheckScale: document.getElementById('plan-check-scale'),
    planPriceStarter: document.getElementById('plan-price-starter'),
    planPriceGrowth: document.getElementById('plan-price-growth'),
    planPriceScale: document.getElementById('plan-price-scale'),
    planPeriodStarter: document.getElementById('plan-period-starter'),
    planPeriodGrowth: document.getElementById('plan-period-growth'),
    planPeriodScale: document.getElementById('plan-period-scale'),
    planSubtextStarter: document.getElementById('plan-subtext-starter'),
    planSubtextGrowth: document.getElementById('plan-subtext-growth'),
    planSubtextScale: document.getElementById('plan-subtext-scale'),
    featuresPlanTitle: document.getElementById('features-plan-title'),
    featuresTeamSize: document.getElementById('features-team-size'),
    featuresListContainer: document.getElementById('features-list-container'),
    billingChargeSummary: document.getElementById('billing-charge-summary'),
    formBillingPayment: document.getElementById('form-billing-payment'),
    inputCardName: document.getElementById('input-card-name'),
    inputCardNumber: document.getElementById('input-card-number'),
    inputCardExp: document.getElementById('input-card-exp'),
    inputCardCvc: document.getElementById('input-card-cvc'),
    inputCardZip: document.getElementById('input-card-zip'),
    billingErrorMsg: document.getElementById('billing-error-msg'),
    btnSubmitPayment: document.getElementById('btn-submit-payment'),
    btnSubmitPaymentText: document.getElementById('btn-submit-payment-text'),
    btnSubmitPaymentSpinner: document.getElementById('btn-submit-payment-spinner'),
    billingReceiptContainer: document.getElementById('billing-receipt-container'),
    receiptPlan: document.getElementById('receipt-plan'),
    receiptAmount: document.getElementById('receipt-amount'),
    receiptTxn: document.getElementById('receipt-txn'),
    receiptExpiry: document.getElementById('receipt-expiry'),
    btnFinishBilling: document.getElementById('btn-finish-billing'),

    // Trial Expired Modal
    trialExpiredModal: document.getElementById('trial-expired-modal'),
    expiredModalMsg: document.getElementById('expired-modal-msg'),
    expiredWebActions: document.getElementById('expired-web-actions'),
    btnExpiredUpgrade: document.getElementById('btn-expired-upgrade'),
    expiredMobileActions: document.getElementById('expired-mobile-actions'),
    btnExpiredLogout: document.getElementById('btn-expired-logout'),
  };

  // --- SMB BUSINESS CATEGORIES ---
  const BUSINESS_TYPES = [
    { icon: '🍽️', name: 'Restaurant, Cafe & Bakery' },
    { icon: '🛍️', name: 'Retail Store & Boutique' },
    { icon: '🔨', name: 'Construction & General Contracting' },
    { icon: '🏥', name: 'Healthcare, Clinic & Dental' },
    { icon: '💇', name: 'Salon, Spa & Barbershop' },
    { icon: '🧹', name: 'Cleaning & Janitorial Services' },
    { icon: '🚚', name: 'Logistics, Moving & Warehousing' },
    { icon: '🏨', name: 'Hospitality, Hotel & Lodging' },
    { icon: '🚗', name: 'Automotive Repair & Dealership' },
    { icon: '🏋️', name: 'Fitness Gym, Yoga & Martial Arts' },
    { icon: '🛠️', name: 'Plumbing, HVAC & Electrical' },
    { icon: '🌿', name: 'Landscaping & Grounds Care' },
    { icon: '📦', name: 'Wholesale, Supply & Distribution' },
    { icon: '🎓', name: 'Education, Daycare & Tutoring' },
    { icon: '☕', name: 'Coffee Shop & Food Truck' },
    { icon: '💻', name: 'IT, Tech & Consulting Services' },
    { icon: '🛡️', name: 'Security & Facility Management' },
    { icon: '🎨', name: 'Creative Agency, Studio & Media' },
    { icon: '🐾', name: 'Pet Care, Grooming & Veterinary' },
    { icon: '🏢', name: 'Real Estate & Property Management' },
    { icon: '⚖️', name: 'Accounting, Tax & Legal Services' },
    { icon: '🌐', name: 'General Business / Other' }
  ];

  function safeEscapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function initSearchableDropdown(inputEl, toggleBtnEl, listEl, arrowEl, options, onSelect) {
    if (!inputEl || !listEl) return;

    let isOpen = false;

    function renderOptions(filterText = '') {
      const query = (filterText || '').trim().toLowerCase();
      const filtered = options.filter(opt => {
        if (!query) return true;
        return opt.name.toLowerCase().includes(query);
      });

      listEl.innerHTML = '';

      if (filtered.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'px-3 py-2 text-warmgray-500 italic text-xs hover:bg-amber-50 cursor-pointer flex items-center justify-between';
        emptyItem.innerHTML = `<span>Use: <strong>${safeEscapeHtml(filterText)}</strong></span> <span class="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded font-semibold">Custom</span>`;
        emptyItem.addEventListener('click', () => {
          inputEl.value = filterText;
          closeDropdown();
          if (typeof onSelect === 'function') onSelect(filterText);
        });
        listEl.appendChild(emptyItem);
      } else {
        filtered.forEach(opt => {
          const li = document.createElement('li');
          li.className = 'px-3 py-2 text-warmgray-700 hover:bg-amber-50 hover:text-amber-900 cursor-pointer flex items-center gap-2 transition-colors select-none';
          li.innerHTML = `<span class="text-sm">${opt.icon}</span> <span class="font-medium">${safeEscapeHtml(opt.name)}</span>`;
          li.addEventListener('click', (e) => {
            e.stopPropagation();
            inputEl.value = opt.name;
            closeDropdown();
            if (typeof onSelect === 'function') onSelect(opt.name);
          });
          listEl.appendChild(li);
        });
      }
    }

    function openDropdown() {
      if (isOpen) return;
      isOpen = true;
      renderOptions(inputEl.value);
      listEl.classList.remove('hidden');
      if (arrowEl) arrowEl.classList.add('rotate-180');
    }

    function closeDropdown() {
      if (!isOpen) return;
      isOpen = false;
      listEl.classList.add('hidden');
      if (arrowEl) arrowEl.classList.remove('rotate-180');
    }

    function toggleDropdown() {
      if (isOpen) closeDropdown();
      else openDropdown();
    }

    inputEl.addEventListener('focus', () => {
      openDropdown();
    });

    inputEl.addEventListener('input', () => {
      if (!isOpen) {
        isOpen = true;
        listEl.classList.remove('hidden');
        if (arrowEl) arrowEl.classList.add('rotate-180');
      }
      renderOptions(inputEl.value);
    });

    if (toggleBtnEl) {
      toggleBtnEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputEl.focus();
        toggleDropdown();
      });
    }

    // Dismiss on click outside
    document.addEventListener('click', (e) => {
      if (!isOpen) return;
      if (!inputEl.contains(e.target) && !listEl.contains(e.target) && (!toggleBtnEl || !toggleBtnEl.contains(e.target))) {
        closeDropdown();
      }
    });

    // Keyboard navigation
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDropdown();
      } else if (e.key === 'Enter') {
        if (isOpen) {
          e.preventDefault();
          const firstItem = listEl.querySelector('li');
          if (firstItem) {
            firstItem.click();
          } else {
            closeDropdown();
          }
        }
      }
    });
  }

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

  // --- NATIVE MOBILE APP DETECTION ---
  function isNativeMobileApp() {
    if (typeof window !== 'undefined') {
      if (window.__CREWCLOCK_NATIVE_APP__ === true) return true;
      if (window.AndroidBridge !== undefined) return true;
      if (navigator.userAgent && /CrewClockApp/i.test(navigator.userAgent)) return true;
    }
    return false;
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
      if (session.accessToken && (!session.tokenExpiresAt || Date.now() < session.tokenExpiresAt)) {
        currentAccessToken = session.accessToken;
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
      businessName: user.businessName || user.restaurantName || settings.businessName || settings.restaurantName,
      restaurantName: user.businessName || user.restaurantName || settings.businessName || settings.restaurantName,
      businessType: user.businessType || settings.businessType || 'General Business',
      businessLogo: user.businessLogo !== undefined ? user.businessLogo : (user.restaurantLogo !== undefined ? user.restaurantLogo : settings.businessLogo),
      restaurantLogo: user.businessLogo !== undefined ? user.businessLogo : (user.restaurantLogo !== undefined ? user.restaurantLogo : settings.restaurantLogo),
      attendanceScriptUrl: user.attendanceScriptUrl || settings.scriptUrl,
      timeZone: user.timeZone || 'America/Los_Angeles',
      subscription: user.subscription || (currentUser?.subscription ? currentUser.subscription : {
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
      accessToken: user.accessToken || currentAccessToken || '',
      tokenExpiresAt: user.tokenExpiresAt || (currentAccessToken ? Date.now() + 3500 * 1000 : 0),
      loginTime: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION_MS
    };
    currentUser = session;
    if (session.accessToken) {
      currentAccessToken = session.accessToken;
    }
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    applyBrandSettings();
    updateHeaderUserUI();
    updateRoleBasedUI();
    return session;
  }

  function clearUserSession(isExpired) {
    currentUser = null;
    currentAccessToken = null;
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
          if (sub.isPaid && sub.isValid) {
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
    const isAdmin = currentUser && currentUser.role === 'admin';
    const isMobileApp = isNativeMobileApp();
    const isDesktopWebApp = !isMobileApp && window.innerWidth >= 768;
    const canAccessBilling = isAdmin && isDesktopWebApp;
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

    // Desktop Top Navigation Buttons (Only visible on widescreen desktop >= 1024px when user has active session; hidden on native mobile apps)
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

    // Mobile Bottom Navigation Dock (Visible on mobile whenever user is logged in, both BEFORE and AFTER clock-in)
    if (el.mobileBottomNav) {
      if (hasSession) {
        el.mobileBottomNav.classList.remove('hidden');
      } else {
        el.mobileBottomNav.classList.add('hidden');
      }
    }

    // Mobile Bottom Navigation Tabs:
    // Shift & History always available for all logged-in staff
    if (el.mobileNavClock) el.mobileNavClock.classList.remove('hidden');
    if (el.mobileNavHistory) el.mobileNavHistory.classList.remove('hidden');

    // Team management tab (Admin only)
    if (el.mobileNavTeam) {
      if (isAdmin) el.mobileNavTeam.classList.remove('hidden');
      else el.mobileNavTeam.classList.add('hidden');
    }

    // Mobile Nav Billing Tab (Admin only - now enabled with 15% store fee pricing)
    if (el.mobileNavBilling) {
      if (isAdmin && hasSession) el.mobileNavBilling.classList.remove('hidden');
      else el.mobileNavBilling.classList.add('hidden');
    }

    // Business Settings tab (Admin only)
    if (el.mobileNavSettings) {
      if (isAdmin) el.mobileNavSettings.classList.remove('hidden');
      else el.mobileNavSettings.classList.add('hidden');
    }

    // Settings Modal Billing Section: visible for Admin across desktop and mobile
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

  // --- MOBILE BOTTOM DOCK ACTIVE TAB HIGHLIGHT ---
  function setActiveMobileTab(activeId) {
    const tabs = [
      { id: 'shift', el: el.mobileNavClock },
      { id: 'history', el: el.mobileNavHistory },
      { id: 'team', el: el.mobileNavTeam },
      { id: 'billing', el: el.mobileNavBilling },
      { id: 'settings', el: el.mobileNavSettings }
    ];
    tabs.forEach(tab => {
      if (!tab.el) return;
      if (tab.id === activeId) {
        tab.el.classList.add('text-amber-600', 'font-bold', 'active');
        tab.el.classList.remove('text-warmgray-500', 'text-warmgray-600');
      } else {
        tab.el.classList.remove('text-amber-600', 'font-bold', 'active');
        tab.el.classList.add('text-warmgray-500');
      }
    });
  }

  // --- SCREEN CONTROLLER ---
  function refreshScreenState() {
    const session = getUserSession();
    updateHeaderUserUI();
    updateRoleBasedUI();
    setActiveMobileTab('shift');

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
    const isAdmin = user.role === 'admin';

    if (el.readyUserName) el.readyUserName.textContent = user.name || 'Staff Member';
    if (el.readyUserEmail) el.readyUserEmail.textContent = user.email || '';

    // Custom greeting for Admin vs Staff
    if (el.readyScreenGreeting) {
      el.readyScreenGreeting.textContent = isAdmin ? 'Admin Workspace & Shift' : 'Ready for your shift?';
    }

    // Role badge on ready card
    if (el.readyRoleBadge) {
      if (isAdmin) {
        el.readyRoleBadge.textContent = '👑 Business Admin';
        el.readyRoleBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300';
        el.readyRoleBadge.classList.remove('hidden');
      } else {
        el.readyRoleBadge.textContent = 'Staff Member';
        el.readyRoleBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-warmgray-100 text-warmgray-700 border border-warmgray-200';
        el.readyRoleBadge.classList.remove('hidden');
      }
    }

    // Plan / Subscription badge on ready card (Admin only)
    if (el.readyPlanBadge) {
      if (!isAdmin) {
        el.readyPlanBadge.textContent = '';
        el.readyPlanBadge.classList.add('hidden');
      } else {
        const sub = user.subscription;
        if (sub && sub.isPaid && sub.isValid) {
          el.readyPlanBadge.textContent = sub.plan || 'Pro Active';
          el.readyPlanBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300';
          el.readyPlanBadge.classList.remove('hidden');
        } else if (sub && sub.isTrial && sub.isValid) {
          const days = typeof sub.daysRemaining === 'number' ? sub.daysRemaining : 14;
          el.readyPlanBadge.textContent = `${days}d Free Trial`;
          el.readyPlanBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300';
          el.readyPlanBadge.classList.remove('hidden');
        } else if (sub && !sub.isValid) {
          el.readyPlanBadge.textContent = 'Trial Expired';
          el.readyPlanBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300';
          el.readyPlanBadge.classList.remove('hidden');
        } else {
          el.readyPlanBadge.textContent = '';
          el.readyPlanBadge.classList.add('hidden');
        }
      }
    }

    // Safe Avatar image with initials fallback
    const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (el.readyUserInitials) el.readyUserInitials.textContent = initials;

    if (user.picture) {
      if (el.readyUserInitials) el.readyUserInitials.classList.add('hidden');
      if (el.readyUserImg) {
        el.readyUserImg.onerror = () => {
          el.readyUserImg.classList.add('hidden');
          if (el.readyUserInitials) el.readyUserInitials.classList.remove('hidden');
        };
        el.readyUserImg.src = user.picture;
        el.readyUserImg.classList.remove('hidden');
      }
    } else {
      if (el.readyUserImg) el.readyUserImg.classList.add('hidden');
      if (el.readyUserInitials) el.readyUserInitials.classList.remove('hidden');
    }
  }

  function populateActiveShiftScreen(shift) {
    if (!shift) return;

    if (el.userName) el.userName.textContent = shift.name || 'Staff Member';
    if (el.userEmail) el.userEmail.textContent = shift.email || '';

    const initials = (shift.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (el.userAvatarInitials) el.userAvatarInitials.textContent = initials;

    if (shift.picture) {
      if (el.userAvatarInitials) el.userAvatarInitials.classList.add('hidden');
      if (el.userAvatarImg) {
        el.userAvatarImg.onerror = () => {
          el.userAvatarImg.classList.add('hidden');
          if (el.userAvatarInitials) el.userAvatarInitials.classList.remove('hidden');
        };
        el.userAvatarImg.src = shift.picture;
        el.userAvatarImg.classList.remove('hidden');
      }
    } else {
      if (el.userAvatarImg) el.userAvatarImg.classList.add('hidden');
      if (el.userAvatarInitials) el.userAvatarInitials.classList.remove('hidden');
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
    const rawTarget = currentUser?.attendanceScriptUrl || settings.scriptUrl;
    const syncUrl = (isGoogleAppsScriptUrl(rawTarget) ? rawTarget : null) || settings.tenancyScriptUrl;
    if (!syncUrl || syncUrl.trim().length === 0) return;
    try {
      const startTime = Date.now();
      const res = await fetch(syncUrl, {
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
        if (data.serviceEmail) {
          platformServiceEmail = data.serviceEmail;
          updateServiceEmailInModals();
        }
        console.log(`[TimeSync] Synchronized with Google Server Time (Offset: ${serverTimeOffsetMs}ms, TZ: ${serverTimeZone}, Host: ${platformServiceEmail || 'Central'})`);
        updateSyncBadgeUI();
      }
    } catch (err) {
      console.warn('[TimeSync] Google server ping unavailable, falling back to local clock:', err);
    }
  }

  function updateServiceEmailInModals() {
    if (!platformServiceEmail) return;
    const onboardHint = document.getElementById('onboard-sheet-hint');
    if (onboardHint) {
      onboardHint.innerHTML = `Create a sheet at <a href="https://sheets.new" target="_blank" class="underline text-amber-700 font-bold">sheets.new</a>, copy its link/ID, and share it with <code class="bg-amber-100/90 text-amber-900 font-mono px-1 py-0.5 rounded font-bold select-all">${escapeHtml(platformServiceEmail)}</code> as <strong>Editor</strong>. Staff has zero direct access to tamper. Or paste a custom Apps Script URL.`;
    }
    const settingsHint = document.getElementById('settings-sheet-hint');
    if (settingsHint) {
      settingsHint.innerHTML = `Google Sheet ID or URL (Share with <code class="bg-amber-100/90 text-amber-900 font-mono px-1 py-0.5 rounded font-bold select-all">${escapeHtml(platformServiceEmail)}</code> as Editor). Staff members have 0 direct access. Alternatively, enter an Apps Script Web App URL.`;
    }
  }

  // --- BRAND & CONFIG DISPLAY ---
  function applyBrandSettings() {
    const defaultOrgName = fileConfig.organizationName || fileConfig.businessName || fileConfig.restaurantName || 'Lightning Ventures LLC';
    const brandName = currentUser?.businessName || currentUser?.restaurantName || settings.businessName || settings.restaurantName || defaultOrgName;
    const brandLogo = currentUser?.businessLogo !== undefined ? currentUser.businessLogo : (currentUser?.restaurantLogo !== undefined ? currentUser.restaurantLogo : (settings.businessLogo || settings.restaurantLogo));

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

  // --- GOOGLE SPREADSHEET & APPS SCRIPT HELPERS ---
  function extractSpreadsheetId(input) {
    if (!input || typeof input !== 'string') return '';
    const clean = input.trim();
    // 1. Matches Google Sheet URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/...
    const urlMatch = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    // 2. Alphanumeric Sheet ID (~44 chars) that is not a script url
    if (/^[a-zA-Z0-9-_]{20,}$/.test(clean) && !clean.includes('script.google.com')) {
      return clean;
    }
    return clean;
  }

  function isGoogleAppsScriptUrl(str) {
    return typeof str === 'string' && str.includes('script.google.com');
  }

  function isGoogleSpreadsheetTarget(target) {
    if (!target) return false;
    const clean = target.trim();
    if (isGoogleAppsScriptUrl(clean)) return false;
    const sheetId = extractSpreadsheetId(clean);
    return /^[a-zA-Z0-9-_]{20,}$/.test(sheetId);
  }

  function formatDateOnly(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
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

  // Get a valid Google OAuth access token, silently refreshing or prompting if needed
  async function getValidAccessToken(forcePrompt = false) {
    if (!forcePrompt && currentAccessToken) {
      const expiresAt = currentUser?.tokenExpiresAt || 0;
      if (expiresAt === 0 || Date.now() < expiresAt - 60000) {
        return currentAccessToken;
      }
    }

    if (!tokenClient) initGoogleAuth();
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
        currentAccessToken = resp.access_token;
        const expiresAt = Date.now() + (resp.expires_in ? Number(resp.expires_in) * 1000 : 3500 * 1000);
        if (currentUser) {
          currentUser.accessToken = currentAccessToken;
          currentUser.tokenExpiresAt = expiresAt;
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(currentUser));
        }
        resolve(currentAccessToken);
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

  // --- GOOGLE SHEETS REST API (v4) CLIENT ---
  async function ensureSheetHeaders(sheetId, token) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?includeGridData=false`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 403) {
      throw new Error(
        'Google Sheet Access Denied (403):\n\n' +
        'Please open your Google Sheet, click "Share", and ensure either:\n' +
        '1. Your signed-in Google account is added as Editor, OR\n' +
        '2. General access is set to "Anyone with the link can edit".'
      );
    }
    if (res.status === 404) {
      throw new Error(
        'Google Sheet Not Found (404):\n\n' +
        'Please verify that the Google Sheet ID or URL entered in Settings is correct.'
      );
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Google Sheets API Error (${res.status}): ${errBody || res.statusText}`);
    }

    const sheetMeta = await res.json();
    const sheets = sheetMeta.sheets || [];
    let hasAttendanceTab = sheets.some(s => s.properties && s.properties.title === 'Attendance');

    // Auto-create Attendance tab if absent
    if (!hasAttendanceTab) {
      try {
        const addSheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: { title: 'Attendance' }
                }
              }
            ]
          })
        });
        if (addSheetRes.ok) {
          hasAttendanceTab = true;
        }
      } catch (e) {
        console.warn('Could not auto-create Attendance tab:', e);
      }
    }

    const targetTab = hasAttendanceTab ? 'Attendance' : (sheets[0]?.properties?.title || 'Sheet1');

    // Check if row 1 has headers; if not, write standard headers
    try {
      const headerCheckRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(targetTab)}!A1:K1`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (headerCheckRes.ok) {
        const headerData = await headerCheckRes.json();
        if (!headerData.values || headerData.values.length === 0 || !headerData.values[0][0]) {
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(targetTab)}!A1:K1?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                range: `${targetTab}!A1:K1`,
                majorDimension: 'ROWS',
                values: [SHEET_HEADERS]
              })
            }
          );
        }
      }
    } catch (e) {
      console.warn('Header check/write warning:', e);
    }

    return targetTab;
  }

  async function appendClockInToSheet(sheetId, token, payload) {
    const targetTab = await ensureSheetHeaders(sheetId, token);
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(targetTab)}!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const rowData = [
      payload.date || '',
      payload.name || '',
      payload.email || '',
      payload.clockInTime || '',
      `${payload.latitude}, ${payload.longitude}`,
      payload.mapsUrl || '',
      '', // Clock Out Time
      '', // Duration
      '', // Clock Out Coordinates
      '', // Clock Out Map
      'Clocked In' // Status
    ];

    const res = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `${targetTab}!A:K`,
        majorDimension: 'ROWS',
        values: [rowData]
      })
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Google Sheets Append Failed (${res.status}): ${errBody || res.statusText}`);
    }

    const data = await res.json();
    let rowNumber = null;
    const updatedRange = data.updates?.updatedRange || '';
    const match = updatedRange.match(/!A(\d+):/i);
    if (match && match[1]) {
      rowNumber = parseInt(match[1], 10);
    }

    return {
      success: true,
      tabName: targetTab,
      rowNumber: rowNumber,
      updatedRange: updatedRange
    };
  }

  async function updateClockOutOnSheet(sheetId, token, rowNumber, tabName = 'Attendance', payload) {
    let targetRow = rowNumber;

    if (!targetRow || targetRow < 2) {
      targetRow = await findOpenShiftRow(sheetId, token, tabName, payload.email);
    }

    if (!targetRow || targetRow < 2) {
      // Fallback: append completed row
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const fallbackRow = [
        payload.date || '',
        payload.name || '',
        payload.email || '',
        payload.clockInTime || '',
        payload.inCoords || '',
        payload.inMapsUrl || '',
        payload.clockOutTime || '',
        payload.duration || '',
        `${payload.latitude}, ${payload.longitude}`,
        payload.mapsUrl || '',
        'Completed'
      ];
      await fetch(appendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: `${tabName}!A:K`,
          majorDimension: 'ROWS',
          values: [fallbackRow]
        })
      });
      return { success: true, rowNumber: null };
    }

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}!G${targetRow}:K${targetRow}?valueInputOption=USER_ENTERED`;
    const outValues = [
      payload.clockOutTime || '',
      payload.duration || '',
      `${payload.latitude}, ${payload.longitude}`,
      payload.mapsUrl || '',
      'Completed'
    ];

    const res = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `${tabName}!G${targetRow}:K${targetRow}`,
        majorDimension: 'ROWS',
        values: [outValues]
      })
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Google Sheets Update Failed (${res.status}): ${errBody || res.statusText}`);
    }

    return { success: true, rowNumber: targetRow };
  }

  async function findOpenShiftRow(sheetId, token, tabName, userEmail) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}!A:K`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      const rows = data.values || [];
      const targetEmail = (userEmail || '').trim().toLowerCase();

      // Search bottom to top for active shift
      for (let i = rows.length - 1; i >= 1; i--) {
        const row = rows[i];
        const rowEmail = (row[2] || '').trim().toLowerCase();
        const rowClockOut = (row[6] || '').trim();
        const rowStatus = (row[10] || '').trim();

        if (rowEmail === targetEmail && (!rowClockOut || rowStatus === 'Clocked In')) {
          return i + 1; // 1-indexed row number
        }
      }
    } catch (e) {
      console.warn('findOpenShiftRow scan warning:', e);
    }
    return null;
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
          ? 'Opening Google Account chooser for Business Signup...'
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

    currentAccessToken = tokenResponse.access_token;
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
                businessName: tenant.businessName || tenant.restaurantName || settings.businessName,
                restaurantName: tenant.businessName || tenant.restaurantName || settings.businessName,
                businessType: tenant.businessType || settings.businessType || 'General Business',
                businessLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : settings.businessLogo,
                restaurantLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : settings.restaurantLogo,
                attendanceScriptUrl: tenant.attendanceSheetId || tenant.attendanceScriptUrl || settings.scriptUrl,
                timeZone: tenant.timeZone || 'America/Los_Angeles',
                subscription: tenancyRes.subscription || tenant.subscription,
                accessToken: currentAccessToken,
                tokenExpiresAt: tokenExpiresAt
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
                el.uninvitedUserText.textContent = `Account "${email}" is not registered in any business workspace. Please ask your business manager to invite this Gmail, or sign up as a business owner below.`;
              }
              if (el.uninvitedUserAlert) el.uninvitedUserAlert.classList.remove('hidden');
              return;
            }

          // SCENARIO 2: SIGN UP FLOW (Business Owners)
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
                  businessName: tenant.businessName || tenant.restaurantName || settings.businessName,
                  restaurantName: tenant.businessName || tenant.restaurantName || settings.businessName,
                  businessType: tenant.businessType || settings.businessType || 'General Business',
                  businessLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : settings.businessLogo,
                  restaurantLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : settings.restaurantLogo,
                  attendanceScriptUrl: tenant.attendanceSheetId || tenant.attendanceScriptUrl || settings.scriptUrl,
                  timeZone: tenant.timeZone || 'America/Los_Angeles',
                  subscription: tenancyRes.subscription || tenant.subscription,
                  accessToken: currentAccessToken,
                  tokenExpiresAt: tokenExpiresAt
                });
                syncServerTime();
                refreshScreenState();
                alert(`Welcome back, ${name}!\nYou are already registered as Admin for "${tenant.businessName || tenant.restaurantName || 'your business'}".`);
              } else {
                alert(`Account "${email}" is already registered as an employee at "${tenancyRes.tenant?.businessName || tenancyRes.tenant?.restaurantName || 'a business'}". Please use "Sign In with Google" instead.`);
              }
              return;
            }

            // New Admin -> Open Onboarding Modal to capture Business details
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
        businessName: settings.businessName,
        restaurantName: settings.restaurantName,
        businessType: settings.businessType,
        businessLogo: settings.businessLogo,
        restaurantLogo: settings.restaurantLogo,
        attendanceScriptUrl: settings.scriptUrl,
        accessToken: currentAccessToken,
        tokenExpiresAt: tokenExpiresAt
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

  // --- BUSINESS ONBOARDING (SIGNUP) ---
  function openOnboardingModal() {
    if (!pendingAdminProfile) return;
    if (el.inputOnboardName) el.inputOnboardName.value = '';
    if (el.inputOnboardBusinessType) el.inputOnboardBusinessType.value = '';
    if (el.inputOnboardLogo) el.inputOnboardLogo.value = '';
    if (el.inputOnboardAttendanceUrl) el.inputOnboardAttendanceUrl.value = settings.scriptUrl || '';
    if (el.onboardTrialDesc) {
      if (isNativeMobileApp()) {
        el.onboardTrialDesc.textContent = 'Every new business workspace gets 2 weeks of full free trial access. After your trial, continuing your subscription is handled securely via our Web Portal at crewclock.com (subscription purchase is not available inside mobile apps).';
      } else {
        el.onboardTrialDesc.textContent = 'Every new business workspace gets 2 weeks of full free trial access. After your trial, continuing your subscription is handled securely via the Web Portal.';
      }
    }
    if (el.onboardingModal) el.onboardingModal.classList.remove('hidden');
  }

  function closeOnboardingModal() {
    if (el.onboardingModal) el.onboardingModal.classList.add('hidden');
    pendingAdminProfile = null;
  }

  async function submitOnboarding() {
    if (!pendingAdminProfile) {
      alert('Admin registration session expired. Please click "Sign Up Your Business" again.');
      closeOnboardingModal();
      return;
    }

    const adminEmail = pendingAdminProfile.email;
    const adminName = pendingAdminProfile.name || 'Business Admin';
    const adminPicture = pendingAdminProfile.picture || '';

    const businessName = (el.inputOnboardName?.value || '').trim();
    const businessType = (el.inputOnboardBusinessType?.value || '').trim() || 'General Business';
    const logoUrl = (el.inputOnboardLogo?.value || '').trim();
    const rawAttendanceInput = (el.inputOnboardAttendanceUrl?.value || '').trim();
    const attendanceTarget = extractSpreadsheetId(rawAttendanceInput);
    const timeZone = el.inputOnboardTimezone?.value || 'America/Los_Angeles';

    if (!businessName) {
      alert('Please enter your Business / Company Name.');
      el.inputOnboardName?.focus();
      return;
    }

    if (!attendanceTarget) {
      alert('Please enter your Attendance Google Sheet ID (or URL) where employee clock-ins will be logged.');
      el.inputOnboardAttendanceUrl?.focus();
      return;
    }

    try {
      showLoading('Creating Business Workspace', 'Registering your business and provisioning Admin privileges...');
      const res = await callTenancyApi('signup', {
        email: adminEmail,
        name: adminName,
        businessName: businessName,
        restaurantName: businessName,
        businessType: businessType,
        logoUrl: logoUrl,
        attendanceScriptUrl: attendanceTarget,
        attendanceSheetId: attendanceTarget,
        timeZone: timeZone
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to create business workspace.');
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
        businessName: tenant.businessName || tenant.restaurantName || businessName,
        restaurantName: tenant.businessName || tenant.restaurantName || businessName,
        businessType: tenant.businessType || businessType,
        businessLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : logoUrl,
        restaurantLogo: tenant.logoUrl !== undefined ? tenant.logoUrl : logoUrl,
        attendanceScriptUrl: tenant.attendanceSheetId || tenant.attendanceScriptUrl || attendanceTarget,
        timeZone: tenant.timeZone || timeZone || 'America/Los_Angeles',
        subscription: res.subscription || tenant.subscription,
        accessToken: currentAccessToken
      });

      closeOnboardingModal();
      hideLoading();
      syncServerTime();
      refreshScreenState();

      setTimeout(() => {
        alert(`🎉 Welcome to CrewClock, ${adminName}!\n\nWorkspace "${businessName}" is ready. You can now invite staff to sign in using the Team icon in the top header.`);
      }, 100);
    } catch (err) {
      hideLoading();
      alert('Onboarding Error: ' + err.message);
    }
  }

  // --- TEAM MANAGEMENT (ADMIN RBAC) ---
  function openTeamModal() {
    if (!currentUser || currentUser.role !== 'admin') {
      alert('Only authorized business Admins can access Team Management.');
      return;
    }
    if (el.teamModal) el.teamModal.classList.remove('hidden');
    if (el.inviteStatusMsg) el.inviteStatusMsg.textContent = '';
    loadTeamRoster();
  }

  function closeTeamModal() {
    if (el.teamModal) el.teamModal.classList.add('hidden');
    if (typeof setActiveMobileTab === 'function') setActiveMobileTab('shift');
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
    if (!confirm(`Are you sure you want to remove ${displayName} from your team?\n\nThey will no longer be permitted to sign in or clock in.`)) {
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

    // Trial / Paid Subscription Verification Check
    if (session.subscription && session.subscription.isValid === false) {
      showTrialExpiredModal();
      return;
    }

    const rawTarget = session.attendanceScriptUrl || settings.scriptUrl || '';
    const isSheetApi = isGoogleSpreadsheetTarget(rawTarget);
    const sheetId = isSheetApi ? extractSpreadsheetId(rawTarget) : null;
    const targetScriptUrl = !isSheetApi && isGoogleAppsScriptUrl(rawTarget) ? rawTarget : null;

    try {
      // Sync server time if not already synced
      if (!isServerTimeSynced && (targetScriptUrl || isSheetApi)) {
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
      const dateStr = formatDateOnly(now);
      const mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

      let sheetRow = null;
      let sheetTab = 'Attendance';

      // 3. Send payload: Choice B (Custom Apps Script Webhook) or Choice A (Tamper-Proof Central Proxy)
      if (targetScriptUrl && isGoogleAppsScriptUrl(targetScriptUrl)) {
        // Choice B: Custom Google Apps Script Webhook
        showLoading('Updating Attendance Sheet', 'Recording clock-in with Google Server Time...');
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
          console.warn('Apps Script submission note:', err);
        } finally {
          hideLoading();
        }
      } else if (settings.tenancyScriptUrl) {
        // Choice A: Tamper-Proof Central Proxy to Merchant Sheet
        // Staff members have 0 direct edit or view access to the spreadsheet!
        showLoading('Updating Attendance Sheet', 'Recording tamper-proof clock-in to Google Sheet...');
        try {
          const res = await callTenancyApi('log_shift', {
            subAction: 'clockin',
            tenantId: session.tenantId,
            email: session.email,
            name: session.name,
            latitude: location.latitude.toFixed(5),
            longitude: location.longitude.toFixed(5),
            accuracy: Math.round(location.accuracy),
            timestamp: timestampStr,
            clockInIso: now.toISOString()
          });

          if (!res.success) {
            if (res.expired) {
              if (session.subscription) session.subscription.isValid = false;
              saveUserSession(session);
              showTrialExpiredModal();
              return;
            }
            throw new Error(res.error || 'Could not record clock-in.');
          }
          sheetRow = res.rowNumber;
          sheetTab = res.tabName || 'Attendance';
        } catch (proxyErr) {
          console.error('Tamper-Proof Attendance Sync Error:', proxyErr);
          alert('Attendance Sync Notice:\n\n' + proxyErr.message + '\n\nYour shift has been recorded locally on your device.');
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
        clockInDate: dateStr,
        clockInTime: timestampStr,
        clockInIso: now.toISOString(),
        latitude: location.latitude.toFixed(5),
        longitude: location.longitude.toFixed(5),
        accuracy: Math.round(location.accuracy),
        mapsUrl: mapsUrl,
        status: 'Clocked In',
        serverSynced: isServerTimeSynced,
        sheetRow: sheetRow,
        sheetTab: sheetTab,
        sheetId: sheetId
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

    const rawTarget = session.attendanceScriptUrl || settings.scriptUrl || '';
    const isSheetApi = isGoogleSpreadsheetTarget(rawTarget);
    const sheetId = isSheetApi ? (activeShift.sheetId || extractSpreadsheetId(rawTarget)) : null;
    const targetScriptUrl = !isSheetApi && isGoogleAppsScriptUrl(rawTarget) ? rawTarget : null;

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

      // 2. Send clockout: Choice B (Custom Apps Script Webhook) or Choice A (Tamper-Proof Central Proxy)
      if (targetScriptUrl && isGoogleAppsScriptUrl(targetScriptUrl)) {
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
      } else if (settings.tenancyScriptUrl) {
        try {
          const res = await callTenancyApi('log_shift', {
            subAction: 'clockout',
            tenantId: session.tenantId,
            email: activeShift.email,
            name: activeShift.name,
            sheetRow: activeShift.sheetRow,
            clockInDate: activeShift.clockInDate || formatDateOnly(now),
            clockInTime: activeShift.clockInTime,
            inCoords: `${activeShift.latitude}, ${activeShift.longitude}`,
            inMapsUrl: activeShift.mapsUrl,
            latitude: location.latitude.toFixed(5),
            longitude: location.longitude.toFixed(5),
            accuracy: Math.round(location.accuracy),
            timestamp: clockOutTimeStr,
            duration: durationStr,
            clockInIso: activeShift.clockInIso,
            clockOutIso: now.toISOString()
          });

          if (!res.success) {
            throw new Error(res.error || 'Failed to update clock-out.');
          }
        } catch (proxyErr) {
          console.error('Tamper-Proof Clock-Out Sync Error:', proxyErr);
          alert('Clock-Out Sync Notice:\n\n' + proxyErr.message + '\n\nYour clock-out has been recorded locally on your device.');
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

  // POST helper for Attendance Google Apps Script Web App (Fallback for legacy configs)
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
      const rawTarget = currentUser?.attendanceScriptUrl || settings.scriptUrl || '';
      const isScript = isGoogleAppsScriptUrl(rawTarget);
      const isSheetApi = isGoogleSpreadsheetTarget(rawTarget);
      const sheetId = isSheetApi ? extractSpreadsheetId(rawTarget) : null;

      if (isSheetApi && sheetId) {
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
        if (currentUser?.role === 'admin') {
          el.syncStatusText.innerHTML = `Tamper-Proof Google Sheet (<a href="${sheetUrl}" target="_blank" class="underline font-bold text-emerald-900 hover:text-emerald-700">Open Sheet ↗</a>)`;
        } else {
          el.syncStatusText.textContent = 'Protected Google Sheet (Tamper-Proof Cloud Sync)';
        }
        el.syncStatusBadge.className = 'flex items-center gap-1.5 text-[10px] sm:text-[11px] text-emerald-800 bg-emerald-50 rounded-lg p-2 border border-emerald-200';
      } else if (isScript) {
        el.syncStatusText.textContent = isServerTimeSynced
          ? `Verified Google Server Time (${serverTimeZone || 'Tamper-Proof'})`
          : 'Logged to Google Sheet via Google Apps Script (Server Time)';
        el.syncStatusBadge.className = 'flex items-center gap-1.5 text-[10px] sm:text-[11px] text-emerald-800 bg-emerald-50 rounded-lg p-2 border border-emerald-200';
      } else {
        el.syncStatusText.textContent = 'Stored locally (Add Google Sheet ID in Settings to sync)';
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
    if (el.inputRestaurantName) el.inputRestaurantName.value = currentUser?.businessName || currentUser?.restaurantName || settings.businessName || settings.restaurantName || '';
    if (el.inputSettingsBusinessType) el.inputSettingsBusinessType.value = currentUser?.businessType || settings.businessType || '';
    if (el.inputRestaurantLogo) el.inputRestaurantLogo.value = currentUser?.businessLogo !== undefined ? currentUser.businessLogo : (currentUser?.restaurantLogo !== undefined ? currentUser.restaurantLogo : (settings.businessLogo || settings.restaurantLogo || ''));
    if (el.inputScriptUrl) el.inputScriptUrl.value = currentUser?.attendanceScriptUrl || settings.scriptUrl || '';
    if (el.inputSettingsTimezone) el.inputSettingsTimezone.value = currentUser?.timeZone || 'America/Los_Angeles';

    // Populate Subscription status in settings
    const sub = currentUser?.subscription;
    if (sub) {
      if (el.settingsSubPlan) el.settingsSubPlan.textContent = sub.plan || 'Free Trial Plan';
      if (el.settingsSubBadge) {
        if (sub.isPaid && sub.isValid) {
          el.settingsSubBadge.textContent = 'Paid Active';
          el.settingsSubBadge.className = 'text-[10px] text-emerald-800 bg-emerald-100 font-bold px-2 py-0.5 rounded-full border border-emerald-200';
        } else if (sub.isTrial && sub.isValid) {
          el.settingsSubBadge.textContent = '14-Day Free Trial';
          el.settingsSubBadge.className = 'text-[10px] text-amber-800 bg-amber-100 font-bold px-2 py-0.5 rounded-full border border-amber-200';
        } else {
          el.settingsSubBadge.textContent = 'Trial Expired';
          el.settingsSubBadge.className = 'text-[10px] text-rose-800 bg-rose-100 font-bold px-2 py-0.5 rounded-full border border-rose-200';
        }
      }
      if (el.settingsSubExpiry) {
        const days = typeof sub.daysRemaining === 'number' ? sub.daysRemaining : 0;
        const expiryDate = sub.subscriptionEndsAt || sub.trialEndsAt;
        let formattedExp = '';
        if (expiryDate) {
          try {
            formattedExp = ` (Ends ${new Date(expiryDate).toLocaleDateString()})`;
          } catch(e) {}
        }
        if (sub.isValid) {
          el.settingsSubExpiry.textContent = `${days} day${days === 1 ? '' : 's'} remaining${formattedExp}`;
        } else {
          el.settingsSubExpiry.textContent = `Subscription ended${formattedExp}. Please renew on Web.`;
        }
      }
    }

    if (el.settingsModal) el.settingsModal.classList.remove('hidden');
  }

  // --- SUBSCRIPTION & BILLING (DUAL-PLATFORM: WEB BASE & MOBILE STORE OPTION B) ---
  function isMobileBillingEnvironment() {
    if (isNativeMobileApp()) return true;
    if (typeof window !== 'undefined' && window.innerWidth < 768) return true;
    return false;
  }

  const PRICING_PLANS = {
    starter: {
      key: 'starter',
      name: 'Starter Crew',
      teamSize: 'Up to 25 Employees',
      web: {
        monthlyPrice: 9.99,
        yearlyPrice: 99.00,
        monthlyPriceFormatted: '$9.99',
        yearlyPriceFormatted: '$99.00',
        monthlyPeriod: ' / mo',
        yearlyPeriod: ' / yr',
        monthlySubtext: 'Billed monthly',
        yearlySubtext: '$8.25/mo (Billed $99/yr)'
      },
      mobile: {
        monthlyPrice: 11.99,
        yearlyPrice: 119.00,
        monthlyPriceFormatted: '$11.99',
        yearlyPriceFormatted: '$119.00',
        monthlyPeriod: ' / mo',
        yearlyPeriod: ' / yr',
        monthlySubtext: 'Billed monthly (includes 15% store fee)',
        yearlySubtext: '$9.92/mo (Billed $119/yr, includes 15% store fee)'
      },
      // Root-level backward compatibility properties
      monthlyPrice: 9.99,
      yearlyPrice: 99.00,
      monthlyPriceFormatted: '$9.99',
      yearlyPriceFormatted: '$99.00',
      monthlyPeriod: ' / mo',
      yearlyPeriod: ' / yr',
      monthlySubtext: 'Billed monthly',
      yearlySubtext: '$8.25/mo (Billed $99/yr)',
      features: [
        'Instant Sheet sync',
        'Unlimited punches',
        'Mobile web/app clock-in',
        'Up to 25 active employees'
      ]
    },
    growth: {
      key: 'growth',
      name: 'Growth Crew',
      teamSize: '26 – 50 Employees',
      web: {
        monthlyPrice: 19.99,
        yearlyPrice: 199.00,
        monthlyPriceFormatted: '$19.99',
        yearlyPriceFormatted: '$199.00',
        monthlyPeriod: ' / mo',
        yearlyPeriod: ' / yr',
        monthlySubtext: 'Billed monthly',
        yearlySubtext: '$16.58/mo (Billed $199/yr)'
      },
      mobile: {
        monthlyPrice: 23.99,
        yearlyPrice: 239.00,
        monthlyPriceFormatted: '$23.99',
        yearlyPriceFormatted: '$239.00',
        monthlyPeriod: ' / mo',
        yearlyPeriod: ' / yr',
        monthlySubtext: 'Billed monthly (includes 15% store fee)',
        yearlySubtext: '$19.92/mo (Billed $239/yr, includes 15% store fee)'
      },
      monthlyPrice: 19.99,
      yearlyPrice: 199.00,
      monthlyPriceFormatted: '$19.99',
      yearlyPriceFormatted: '$199.00',
      monthlyPeriod: ' / mo',
      yearlyPeriod: ' / yr',
      monthlySubtext: 'Billed monthly',
      yearlySubtext: '$16.58/mo (Billed $199/yr)',
      features: [
        'All Starter features included',
        'Multi-department tabs',
        'Daily summary alerts',
        '26 – 50 active employees'
      ]
    },
    scale: {
      key: 'scale',
      name: 'Scale Crew',
      teamSize: '51 – 100 Employees',
      web: {
        monthlyPrice: 29.99,
        yearlyPrice: 299.00,
        monthlyPriceFormatted: '$29.99',
        yearlyPriceFormatted: '$299.00',
        monthlyPeriod: ' / mo',
        yearlyPeriod: ' / yr',
        monthlySubtext: 'Billed monthly',
        yearlySubtext: '$24.92/mo (Billed $299/yr)'
      },
      mobile: {
        monthlyPrice: 35.99,
        yearlyPrice: 359.00,
        monthlyPriceFormatted: '$35.99',
        yearlyPriceFormatted: '$359.00',
        monthlyPeriod: ' / mo',
        yearlyPeriod: ' / yr',
        monthlySubtext: 'Billed monthly (includes 15% store fee)',
        yearlySubtext: '$29.92/mo (Billed $359/yr, includes 15% store fee)'
      },
      monthlyPrice: 29.99,
      yearlyPrice: 299.00,
      monthlyPriceFormatted: '$29.99',
      yearlyPriceFormatted: '$299.00',
      monthlyPeriod: ' / mo',
      yearlyPeriod: ' / yr',
      monthlySubtext: 'Billed monthly',
      yearlySubtext: '$24.92/mo (Billed $299/yr)',
      features: [
        'All Growth features included',
        'Priority support',
        'Custom shift tagging',
        '51 – 100 active employees'
      ]
    }
  };

  function getPlanRates(tierKey, isMobile = isMobileBillingEnvironment()) {
    const plan = PRICING_PLANS[tierKey] || PRICING_PLANS.starter;
    const rates = isMobile ? plan.mobile : plan.web;
    return rates || plan.web || plan;
  }

  let selectedPlanTier = 'starter';
  let selectedBillingCycle = 'monthly';

  function setBillingCycle(cycle) {
    selectedBillingCycle = cycle === 'yearly' ? 'yearly' : 'monthly';
    updateBillingUI();
  }

  function setPlanTier(tier) {
    if (PRICING_PLANS[tier]) {
      selectedPlanTier = tier;
      updateBillingUI();
    }
  }

  function updateBillingUI() {
    const isYearly = selectedBillingCycle === 'yearly';
    const isMobile = isMobileBillingEnvironment();

    // 0. Update Platform Notice Banner
    if (el.billingPlatformNotice) {
      if (isMobile) {
        if (el.billingPlatformIcon) el.billingPlatformIcon.textContent = '📱';
        if (el.billingPlatformTitle) el.billingPlatformTitle.textContent = 'Mobile App Store Pricing';
        if (el.billingPlatformBadge) {
          el.billingPlatformBadge.textContent = '+15% Store Fee Included';
          el.billingPlatformBadge.className = 'px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-200 text-amber-900';
        }
        if (el.billingPlatformDesc) {
          el.billingPlatformDesc.innerHTML = 'Prices reflect Apple App Store &amp; Google Play store processing fees. <b>Tip:</b> You can also subscribe on our web portal at <a href="https://crewclock.com" target="_blank" class="text-amber-700 underline font-semibold">crewclock.com</a> for direct base rates ($9.99/mo).';
        }
      } else {
        if (el.billingPlatformIcon) el.billingPlatformIcon.textContent = '💻';
        if (el.billingPlatformTitle) el.billingPlatformTitle.textContent = 'Web Direct Pricing';
        if (el.billingPlatformBadge) {
          el.billingPlatformBadge.textContent = 'Best Value · 0% App Store Fee';
          el.billingPlatformBadge.className = 'px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200';
        }
        if (el.billingPlatformDesc) {
          el.billingPlatformDesc.textContent = 'Direct web billing with 0% app store markups. Subscription works across all devices, including iOS and Android.';
        }
      }
    }

    // 1. Cycle Toggle Buttons
    if (el.btnCycleMonthly && el.btnCycleYearly) {
      if (isYearly) {
        el.btnCycleYearly.className = 'py-2 px-3 rounded-xl font-bold text-xs transition-all bg-white text-warmgray-900 shadow-xs flex items-center justify-center gap-1.5';
        el.btnCycleMonthly.className = 'py-2 px-3 rounded-xl font-bold text-xs transition-all text-warmgray-600 hover:text-warmgray-900 flex items-center justify-center gap-1';
      } else {
        el.btnCycleMonthly.className = 'py-2 px-3 rounded-xl font-bold text-xs transition-all bg-white text-warmgray-900 shadow-xs flex items-center justify-center gap-1';
        el.btnCycleYearly.className = 'py-2 px-3 rounded-xl font-bold text-xs transition-all text-warmgray-600 hover:text-warmgray-900 flex items-center justify-center gap-1.5';
      }
    }

    // 2. Plan Cards Pricing & Selection Styles
    const tiers = ['starter', 'growth', 'scale'];
    tiers.forEach(t => {
      const plan = PRICING_PLANS[t];
      const rates = getPlanRates(t, isMobile);
      const capT = t.charAt(0).toUpperCase() + t.slice(1);
      const priceEl = el[`planPrice${capT}`];
      const periodEl = el[`planPeriod${capT}`];
      const subtextEl = el[`planSubtext${capT}`];
      const cardEl = el[`planCard${capT}`];
      const checkEl = el[`planCheck${capT}`];

      if (priceEl) priceEl.textContent = isYearly ? rates.yearlyPriceFormatted : rates.monthlyPriceFormatted;
      if (periodEl) periodEl.textContent = isYearly ? rates.yearlyPeriod : rates.monthlyPeriod;
      if (subtextEl) subtextEl.textContent = isYearly ? rates.yearlySubtext : rates.monthlySubtext;

      const isSelected = selectedPlanTier === t;
      if (cardEl) {
        if (isSelected) {
          cardEl.className = 'plan-card cursor-pointer p-3.5 rounded-2xl border-2 border-amber-500 bg-amber-50/40 relative transition-all shadow-xs flex flex-col justify-between';
        } else {
          cardEl.className = 'plan-card cursor-pointer p-3.5 rounded-2xl border-2 border-warmgray-200 bg-white relative transition-all hover:border-amber-400 flex flex-col justify-between';
        }
      }
      if (checkEl) {
        if (isSelected) {
          checkEl.className = 'w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]';
        } else {
          checkEl.className = 'w-4 h-4 rounded-full border border-warmgray-300 text-transparent flex items-center justify-center text-[10px]';
        }
      }
    });

    // 3. Dynamic Features Box
    const currentPlan = PRICING_PLANS[selectedPlanTier] || PRICING_PLANS.starter;
    const currentRates = getPlanRates(selectedPlanTier, isMobile);
    if (el.featuresPlanTitle) el.featuresPlanTitle.textContent = `${currentPlan.name} Core Features`;
    if (el.featuresTeamSize) el.featuresTeamSize.textContent = currentPlan.teamSize;
    if (el.featuresListContainer) {
      el.featuresListContainer.innerHTML = currentPlan.features.map(feat => `
        <div class="flex items-center gap-1.5 text-warmgray-700">
          <span class="text-emerald-600 font-bold flex-shrink-0">✓</span>
          <span class="truncate">${escapeHtml(feat)}</span>
        </div>
      `).join('');
    }

    // 4. Charge Summary & Submit Button Text
    const currentPrice = isYearly ? currentRates.yearlyPriceFormatted : currentRates.monthlyPriceFormatted;
    const cycleLabel = isYearly ? 'Annual' : 'Monthly';
    if (el.billingChargeSummary) {
      el.billingChargeSummary.textContent = `Charge: ${currentPrice}`;
    }
    if (el.btnSubmitPaymentText && (!el.btnSubmitPaymentSpinner || el.btnSubmitPaymentSpinner.classList.contains('hidden'))) {
      el.btnSubmitPaymentText.textContent = `Pay ${currentPrice} & Activate ${currentPlan.name} (${cycleLabel})`;
    }
  }

  function openBillingModal() {
    if (!currentUser) {
      alert('Subscription & Billing:\n\nPlease sign in with Google as a Business Admin to manage your workspace subscription.');
      return;
    }
    if (currentUser.role !== 'admin') {
      alert('Only business administrators can access Billing & Subscription settings.');
      return;
    }

    // Reset view
    if (el.billingReceiptContainer) el.billingReceiptContainer.classList.add('hidden');
    if (el.billingCheckoutContainer) el.billingCheckoutContainer.classList.remove('hidden');
    if (el.billingErrorMsg) {
      el.billingErrorMsg.textContent = '';
      el.billingErrorMsg.classList.add('hidden');
    }

    // Populate Current Status
    const sub = currentUser.subscription;
    if (sub) {
      if (el.billingStatusTitle) el.billingStatusTitle.textContent = sub.plan || '14-Day Free Trial';
      if (el.billingStatusDesc) {
        const days = typeof sub.daysRemaining === 'number' ? sub.daysRemaining : 0;
        if (sub.isPaid && sub.isValid) {
          el.billingStatusDesc.textContent = `Subscription active with ${days} day${days === 1 ? '' : 's'} remaining`;
        } else if (sub.isTrial && sub.isValid) {
          el.billingStatusDesc.textContent = `${days} day${days === 1 ? '' : 's'} left in your free trial`;
        } else {
          el.billingStatusDesc.textContent = 'Your 14-day free trial has expired. Select a plan below to continue.';
        }
      }
      if (el.billingStatusChip) {
        if (sub.isPaid && sub.isValid) {
          el.billingStatusChip.textContent = sub.plan ? (sub.plan.includes('(') ? sub.plan.split('(')[0].trim() : sub.plan) : 'Active Plan';
          el.billingStatusChip.className = 'px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 flex-shrink-0';
        } else if (sub.isTrial && sub.isValid) {
          el.billingStatusChip.textContent = 'Trial Active';
          el.billingStatusChip.className = 'px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 flex-shrink-0';
        } else {
          el.billingStatusChip.textContent = 'Expired';
          el.billingStatusChip.className = 'px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-xs border border-rose-200 flex-shrink-0';
        }
      }

      // Pre-select billing cycle & tier if known
      if (sub.billingCycle === 'yearly') {
        selectedBillingCycle = 'yearly';
      } else {
        selectedBillingCycle = 'monthly';
      }

      if (sub.plan) {
        const pLower = sub.plan.toLowerCase();
        if (pLower.includes('starter')) selectedPlanTier = 'starter';
        else if (pLower.includes('scale')) selectedPlanTier = 'scale';
        else if (pLower.includes('growth')) selectedPlanTier = 'growth';
      }
    }

    updateBillingUI();
    if (el.billingModal) el.billingModal.classList.remove('hidden');
  }

  function closeBillingModal() {
    if (el.billingModal) el.billingModal.classList.add('hidden');
    setActiveMobileTab('shift');
  }

  async function handlePaymentSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (!currentUser || !currentUser.tenantId) {
      alert('Business workspace information missing. Please re-login.');
      return;
    }

    const cardName = (el.inputCardName?.value || '').trim();
    const cardNumber = (el.inputCardNumber?.value || '').replace(/\s+/g, '');
    const cardExp = (el.inputCardExp?.value || '').trim();
    const cardCvc = (el.inputCardCvc?.value || '').trim();
    const cardZip = (el.inputCardZip?.value || '').trim();

    if (!cardName || cardNumber.length < 13 || cardExp.length < 5 || cardCvc.length < 3 || !cardZip) {
      if (el.billingErrorMsg) {
        el.billingErrorMsg.textContent = 'Please enter valid credit card details and billing ZIP code.';
        el.billingErrorMsg.classList.remove('hidden');
      }
      return;
    }

    if (el.billingErrorMsg) el.billingErrorMsg.classList.add('hidden');
    if (el.btnSubmitPaymentText) el.btnSubmitPaymentText.textContent = 'Processing Payment...';
    if (el.btnSubmitPaymentSpinner) el.btnSubmitPaymentSpinner.classList.remove('hidden');
    if (el.btnSubmitPayment) el.btnSubmitPayment.disabled = true;

    try {
      const isMobile = isMobileBillingEnvironment();
      const planConfig = PRICING_PLANS[selectedPlanTier] || PRICING_PLANS.starter;
      const planRates = getPlanRates(selectedPlanTier, isMobile);
      const isYearly = selectedBillingCycle === 'yearly';
      const planName = `${planConfig.name} (${isYearly ? 'Annual' : 'Monthly'})`;
      const paidAmount = isYearly ? planRates.yearlyPriceFormatted : planRates.monthlyPriceFormatted;
      const durationDays = isYearly ? 365 : 30;
      const paymentRef = 'PAY_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const platformName = isNativeMobileApp()
        ? (navigator.userAgent && /iPhone|iPad/i.test(navigator.userAgent) ? 'ios_app' : 'android_app')
        : (isMobile ? 'mobile_web' : 'web');

      const res = await callTenancyApi('record_payment', {
        adminEmail: currentUser.email,
        tenantId: currentUser.tenantId,
        plan: planName,
        billingCycle: selectedBillingCycle,
        paidAmount: paidAmount,
        paymentRef: paymentRef,
        durationDays: durationDays,
        platform: platformName
      });

      if (!res.success) {
        throw new Error(res.error || 'Payment processing failed.');
      }

      // Update session with new active subscription
      const updatedSub = res.subscription || {
        status: 'active',
        plan: planName,
        billingCycle: selectedBillingCycle,
        isTrial: false,
        isPaid: true,
        isValid: true,
        daysRemaining: durationDays,
        subscriptionEndsAt: res.payment?.subscriptionEndsAt || new Date(Date.now() + durationDays * 86400000).toISOString(),
        paidAmount: paidAmount,
        paymentRef: paymentRef
      };

      currentUser.subscription = updatedSub;
      saveUserSession(currentUser);
      refreshScreenState();

      // Populate Receipt View
      if (el.receiptPlan) el.receiptPlan.textContent = planName;
      if (el.receiptAmount) el.receiptAmount.textContent = paidAmount;
      if (el.receiptTxn) el.receiptTxn.textContent = paymentRef;
      if (el.receiptExpiry) {
        const expDate = updatedSub.subscriptionEndsAt ? new Date(updatedSub.subscriptionEndsAt).toLocaleDateString() : 'Active';
        el.receiptExpiry.textContent = expDate;
      }

      // Switch to receipt screen
      if (el.billingCheckoutContainer) el.billingCheckoutContainer.classList.add('hidden');
      if (el.billingReceiptContainer) el.billingReceiptContainer.classList.remove('hidden');

      // Clear card inputs for security
      if (el.inputCardNumber) el.inputCardNumber.value = '';
      if (el.inputCardCvc) el.inputCardCvc.value = '';

    } catch (err) {
      if (el.billingErrorMsg) {
        el.billingErrorMsg.textContent = 'Payment Error: ' + err.message;
        el.billingErrorMsg.classList.remove('hidden');
      }
    } finally {
      if (el.btnSubmitPayment) el.btnSubmitPayment.disabled = false;
      if (el.btnSubmitPaymentSpinner) el.btnSubmitPaymentSpinner.classList.add('hidden');
      updateBillingUI();
    }
  }

  // --- TRIAL EXPIRED MODAL ---
  function showTrialExpiredModal() {
    const isMobile = isNativeMobileApp() || window.innerWidth < 768;
    const isAdmin = currentUser && currentUser.role === 'admin';

    if (isAdmin) {
      if (el.expiredWebActions) el.expiredWebActions.classList.remove('hidden');
      if (el.expiredMobileActions) {
        if (isMobile) el.expiredMobileActions.classList.remove('hidden');
        else el.expiredMobileActions.classList.add('hidden');
      }
      if (el.expiredModalMsg) {
        el.expiredModalMsg.textContent = 'The 14-day free trial for your business workspace has expired. Choose a monthly or annual plan to continue uninterrupted attendance tracking.';
      }
    } else {
      if (el.expiredWebActions) el.expiredWebActions.classList.add('hidden');
      if (el.expiredMobileActions) el.expiredMobileActions.classList.add('hidden');
      if (el.expiredModalMsg) {
        el.expiredModalMsg.textContent = 'The 14-day free trial for this business has expired. Please notify your business administrator to renew the workspace subscription.';
      }
    }

    if (el.trialExpiredModal) el.trialExpiredModal.classList.remove('hidden');
  }

  function closeTrialExpiredModal() {
    if (el.trialExpiredModal) el.trialExpiredModal.classList.add('hidden');
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

    // Sign-Up with Google Trigger (Business Owners)
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
    if (el.btnCloseHistory) el.btnCloseHistory.addEventListener('click', () => {
      el.historyModal?.classList.add('hidden');
      setActiveMobileTab('shift');
    });
    if (el.btnCloseHistoryBottom) el.btnCloseHistoryBottom.addEventListener('click', () => {
      el.historyModal?.classList.add('hidden');
      setActiveMobileTab('shift');
    });
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

    const closeSettings = () => {
      el.settingsModal?.classList.add('hidden');
      setActiveMobileTab('shift');
    };
    if (el.btnCloseSettings) el.btnCloseSettings.addEventListener('click', closeSettings);
    if (el.btnCancelSettings) el.btnCancelSettings.addEventListener('click', closeSettings);

    if (el.btnSaveSettings) {
      el.btnSaveSettings.addEventListener('click', () => {
        const updatedName = el.inputRestaurantName?.value.trim() || 'My Business';
        const updatedType = el.inputSettingsBusinessType?.value.trim() || 'General Business';
        const updatedLogo = el.inputRestaurantLogo?.value.trim() || '';
        const rawSheetInput = el.inputScriptUrl?.value.trim() || '';
        const selectedTimezone = el.inputSettingsTimezone?.value || currentUser?.timeZone || 'America/Los_Angeles';

        settings.businessName = updatedName;
        settings.restaurantName = updatedName;
        settings.businessType = updatedType;
        settings.businessLogo = updatedLogo;
        settings.restaurantLogo = updatedLogo;
        settings.scriptUrl = extractSpreadsheetId(rawSheetInput);

        // Save tenant-customizable properties to localStorage
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
          businessName: settings.businessName,
          restaurantName: settings.restaurantName,
          businessType: settings.businessType,
          businessLogo: settings.businessLogo,
          restaurantLogo: settings.restaurantLogo,
          scriptUrl: settings.scriptUrl
        }));

        if (currentUser) {
          currentUser.businessName = settings.businessName;
          currentUser.restaurantName = settings.restaurantName;
          currentUser.businessType = settings.businessType;
          currentUser.businessLogo = settings.businessLogo;
          currentUser.restaurantLogo = settings.restaurantLogo;
          currentUser.attendanceScriptUrl = settings.scriptUrl;
          currentUser.timeZone = selectedTimezone;
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(currentUser));

          // If Admin, sync updated configuration to central tenancy sheet
          if (currentUser.role === 'admin' && settings.tenancyScriptUrl) {
            callTenancyApi('update_config', {
              adminEmail: currentUser.email,
              businessName: settings.businessName,
              restaurantName: settings.restaurantName,
              businessType: settings.businessType,
              logoUrl: settings.businessLogo,
              attendanceScriptUrl: settings.scriptUrl,
              attendanceSheetId: settings.scriptUrl,
              timeZone: selectedTimezone
            }).catch(e => console.warn('[Tenancy] update_config note:', e));
          }
        }

        applyBrandSettings();
        updateSetupWarningVisibility();
        syncServerTime();
        closeSettings();
        alert('Settings saved successfully!');
      });
    }

    // Initialize Searchable Business Type Dropdowns
    initSearchableDropdown(
      el.inputSettingsBusinessType,
      el.btnToggleSettingsBusinessType,
      el.listSettingsBusinessType,
      el.arrowSettingsBusinessType,
      BUSINESS_TYPES
    );
    initSearchableDropdown(
      el.inputOnboardBusinessType,
      el.btnToggleOnboardBusinessType,
      el.listOnboardBusinessType,
      el.arrowOnboardBusinessType,
      BUSINESS_TYPES
    );

    // Mobile Bottom Navigation Events
    if (el.mobileNavClock) {
      el.mobileNavClock.addEventListener('click', () => {
        triggerHaptic();
        setActiveMobileTab('shift');
        if (el.historyModal) el.historyModal.classList.add('hidden');
        if (el.teamModal) el.teamModal.classList.add('hidden');
        if (el.settingsModal) el.settingsModal.classList.add('hidden');
        if (el.farewellModal) el.farewellModal.classList.add('hidden');
        if (el.billingModal) el.billingModal.classList.add('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        refreshScreenState();
      });
    }

    if (el.mobileNavHistory) {
      el.mobileNavHistory.addEventListener('click', () => {
        triggerHaptic();
        setActiveMobileTab('history');
        if (el.teamModal) el.teamModal.classList.add('hidden');
        if (el.settingsModal) el.settingsModal.classList.add('hidden');
        if (el.billingModal) el.billingModal.classList.add('hidden');
        renderHistoryModal();
        if (el.historyModal) el.historyModal.classList.remove('hidden');
      });
    }

    if (el.mobileNavTeam) {
      el.mobileNavTeam.addEventListener('click', () => {
        triggerHaptic();
        if (el.historyModal) el.historyModal.classList.add('hidden');
        if (el.settingsModal) el.settingsModal.classList.add('hidden');
        if (el.billingModal) el.billingModal.classList.add('hidden');

        if (!currentUser) {
          alert('Team Management:\n\nPlease sign in with Google as a Business Admin to manage team members.');
          return;
        }
        if (currentUser.role !== 'admin') {
          alert('Team Management:\n\nOnly authorized business Admins can access Team Management.');
          return;
        }

        setActiveMobileTab('team');
        openTeamModal();
      });
    }

    if (el.mobileNavBilling) {
      el.mobileNavBilling.addEventListener('click', () => {
        triggerHaptic();
        if (el.historyModal) el.historyModal.classList.add('hidden');
        if (el.teamModal) el.teamModal.classList.add('hidden');
        if (el.settingsModal) el.settingsModal.classList.add('hidden');

        if (!currentUser) {
          alert('Subscription & Billing:\n\nPlease sign in with Google as a Business Admin to manage your workspace subscription.');
          return;
        }
        if (currentUser.role !== 'admin') {
          alert('Subscription & Billing:\n\nOnly business administrators can manage subscription and billing.');
          return;
        }

        setActiveMobileTab('billing');
        openBillingModal();
      });
    }

    if (el.mobileNavSettings) {
      el.mobileNavSettings.addEventListener('click', () => {
        triggerHaptic();
        if (el.historyModal) el.historyModal.classList.add('hidden');
        if (el.teamModal) el.teamModal.classList.add('hidden');
        if (el.billingModal) el.billingModal.classList.add('hidden');
        setActiveMobileTab('settings');
        openSettingsModal();
      });
    }

    // Subscription & Billing Events (Web App Only)
    if (el.btnOpenBilling) {
      el.btnOpenBilling.addEventListener('click', () => {
        triggerHaptic();
        openBillingModal();
      });
    }
    if (el.btnCloseBilling) {
      el.btnCloseBilling.addEventListener('click', () => {
        closeBillingModal();
        setActiveMobileTab('shift');
      });
    }
    if (el.btnSettingsUpgrade) {
      el.btnSettingsUpgrade.addEventListener('click', () => {
        triggerHaptic();
        closeSettings();
        openBillingModal();
      });
    }

    if (el.btnCycleMonthly) {
      el.btnCycleMonthly.addEventListener('click', () => {
        triggerHaptic();
        setBillingCycle('monthly');
      });
    }
    if (el.btnCycleYearly) {
      el.btnCycleYearly.addEventListener('click', () => {
        triggerHaptic();
        setBillingCycle('yearly');
      });
    }

    if (el.planCardStarter) {
      el.planCardStarter.addEventListener('click', () => {
        triggerHaptic();
        setPlanTier('starter');
      });
    }
    if (el.planCardGrowth) {
      el.planCardGrowth.addEventListener('click', () => {
        triggerHaptic();
        setPlanTier('growth');
      });
    }
    if (el.planCardScale) {
      el.planCardScale.addEventListener('click', () => {
        triggerHaptic();
        setPlanTier('scale');
      });
    }

    if (el.formBillingPayment) {
      el.formBillingPayment.addEventListener('submit', (e) => {
        triggerHaptic();
        handlePaymentSubmit(e);
      });
    }

    if (el.btnFinishBilling) {
      el.btnFinishBilling.addEventListener('click', () => {
        triggerHaptic();
        closeBillingModal();
        setActiveMobileTab('shift');
        refreshScreenState();
      });
    }

    // Trial Expired Modal Events
    if (el.btnExpiredUpgrade) {
      el.btnExpiredUpgrade.addEventListener('click', () => {
        triggerHaptic();
        closeTrialExpiredModal();
        openBillingModal();
      });
    }
    if (el.btnExpiredLogout) {
      el.btnExpiredLogout.addEventListener('click', () => {
        triggerHaptic();
        closeTrialExpiredModal();
        triggerLogout();
      });
    }

    // Credit Card Input Auto-Formatting
    if (el.inputCardNumber) {
      el.inputCardNumber.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').substring(0, 16);
        val = val.match(/.{1,4}/g)?.join(' ') || val;
        e.target.value = val;
      });
    }
    if (el.inputCardExp) {
      el.inputCardExp.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').substring(0, 4);
        if (val.length >= 3) {
          val = val.substring(0, 2) + '/' + val.substring(2);
        }
        e.target.value = val;
      });
    }

    // Modal backdrop click-to-dismiss for bottom sheets
    [el.farewellModal, el.historyModal, el.settingsModal, el.teamModal, el.billingModal, el.trialExpiredModal].forEach(modalEl => {
      if (modalEl) {
        modalEl.addEventListener('click', (e) => {
          if (e.target === modalEl) {
            modalEl.classList.add('hidden');
            setActiveMobileTab('shift');
          }
        });
      }
    });

    // Window resize listener to dynamically update desktop vs mobile role-based UI
    window.addEventListener('resize', () => {
      updateRoleBasedUI();
    });
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
