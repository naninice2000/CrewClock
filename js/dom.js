/**
 * SheetPunch - DOM Elements & UI Dialogs
 */
window.SheetPunch = window.SheetPunch || window.CrewClock || {};
window.CrewClock = window.SheetPunch;

(function (exports) {
  'use strict';

  // DOM Elements Cache
  const el = {
    // Brand
    restaurantNameDisplay: null,
    brandLogoSvg: null,
    brandLogoImg: null,

    // Live Clock & Date
    liveClock: null,
    liveDate: null,
    locationPill: null,
    locationPillText: null,
    punchSyncBadge: null,
    punchSyncDot: null,
    punchSyncText: null,

    // Header User Profile & Navigation
    headerUserBadge: null,
    headerUserInitials: null,
    headerUserImg: null,
    headerUserName: null,
    headerRolePill: null,
    headerPlanPill: null,
    btnLogoutTrigger: null,
    btnOpenTeam: null,
    btnOpenBilling: null,
    btnOpenHistory: null,
    btnOpenSettings: null,
    headerDesktopNav: null,

    // Mobile Bottom Navigation Dock
    mobileBottomNav: null,
    mobileNavClock: null,
    mobileNavHistory: null,
    mobileNavTeam: null,
    mobileNavBilling: null,
    mobileNavSettings: null,

    // Screens
    screenLogin: null,
    screenClockIn: null,
    screenActiveShift: null,

    // Screen 0: Login View
    btnLoginTrigger: null,
    btnSignupTrigger: null,
    sessionExpiredAlert: null,
    uninvitedUserAlert: null,
    uninvitedUserText: null,
    googleSetupWarning: null,
    btnQuickSetup: null,

    // Screen 1: Ready to Clock In
    readyUserInitials: null,
    readyUserImg: null,
    readyUserName: null,
    readyUserEmail: null,
    readyRoleBadge: null,
    readyPlanBadge: null,
    readyScreenGreeting: null,
    btnClockInTrigger: null,

    // Screen 2: Active Shift
    userName: null,
    userEmail: null,
    userAvatarInitials: null,
    userAvatarImg: null,
    shiftClockInTime: null,
    shiftDurationTimer: null,
    shiftCoords: null,
    shiftAccuracy: null,
    shiftMapsLink: null,
    syncStatusBadge: null,
    syncStatusText: null,
    btnClockOutTrigger: null,

    // Modals
    loadingOverlay: null,
    loadingTitle: null,
    loadingSubtitle: null,

    // Confirm Dialog Modal
    confirmModal: null,
    confirmTitle: null,
    confirmMessage: null,
    confirmIconContainer: null,
    btnConfirmCancel: null,
    btnConfirmOk: null,

    farewellModal: null,
    farewellMessage: null,
    btnCloseFarewell: null,

    settingsModal: null,
    btnCloseSettings: null,
    btnCancelSettings: null,
    btnSettingsLogout: null,
    btnSaveSettings: null,
    inputRestaurantName: null,
    inputSettingsBusinessType: null,
    btnToggleSettingsBusinessType: null,
    listSettingsBusinessType: null,
    arrowSettingsBusinessType: null,
    inputRestaurantLogo: null,
    inputScriptUrl: null,
    inputSettingsTimezone: null,
    settingsBillingSection: null,
    settingsSubBadge: null,
    settingsSubPlan: null,
    settingsSubExpiry: null,
    btnSettingsUpgrade: null,
    settingsMobileSubNote: null,

    historyModal: null,
    btnCloseHistory: null,
    btnCloseHistoryBottom: null,
    btnClearHistory: null,
    historyListContainer: null,

    // Onboarding Modal (Business Owner Signup)
    onboardingModal: null,
    onboardTrialDesc: null,
    inputOnboardName: null,
    inputOnboardBusinessType: null,
    btnToggleOnboardBusinessType: null,
    listOnboardBusinessType: null,
    arrowOnboardBusinessType: null,
    inputOnboardLogo: null,
    inputOnboardAttendanceUrl: null,
    inputOnboardTimezone: null,
    btnCancelOnboard: null,
    btnSaveOnboard: null,

    // Team Modal (Admin RBAC Management)
    teamModal: null,
    btnCloseTeam: null,
    btnCloseTeamBottom: null,
    inputInviteEmail: null,
    inputInviteName: null,
    btnSendInvite: null,
    inviteStatusMsg: null,
    teamListContainer: null,

    // Billing Modal
    billingModal: null,
    btnCloseBilling: null,
    billingStatusBanner: null,
    billingStatusTitle: null,
    billingStatusDesc: null,
    billingStatusChip: null,
    billingCheckoutContainer: null,
    billingPlatformNotice: null,
    billingPlatformIcon: null,
    billingPlatformTitle: null,
    billingPlatformBadge: null,
    billingPlatformDesc: null,
    btnCycleMonthly: null,
    btnCycleYearly: null,
    planCardStarter: null,
    planCardGrowth: null,
    planCardScale: null,
    planCheckStarter: null,
    planCheckGrowth: null,
    planCheckScale: null,
    planPriceStarter: null,
    planPriceGrowth: null,
    planPriceScale: null,
    planPeriodStarter: null,
    planPeriodGrowth: null,
    planPeriodScale: null,
    planSubtextStarter: null,
    planSubtextGrowth: null,
    planSubtextScale: null,
    featuresPlanTitle: null,
    featuresTeamSize: null,
    featuresListContainer: null,
    billingChargeSummary: null,
    formBillingPayment: null,
    inputCardName: null,
    inputCardNumber: null,
    inputCardExp: null,
    inputCardCvc: null,
    inputCardZip: null,
    billingErrorMsg: null,
    btnSubmitPayment: null,
    btnSubmitPaymentText: null,
    btnSubmitPaymentSpinner: null,
    billingReceiptContainer: null,
    receiptPlan: null,
    receiptAmount: null,
    receiptTxn: null,
    btnFinishBilling: null,
    billingCurrentStatusBanner: null,
    btnSimSuccess: null,
    btnSimDeclineFunds: null,
    btnSimDeclineExpired: null,
    btnSimRenewalFail: null,
    btnSimResetTrial: null,

    // Trial Expired Modal
    trialExpiredModal: null,
    expiredModalMsg: null,
    expiredWebActions: null,
    btnExpiredUpgrade: null,
    expiredMobileActions: null,
    btnExpiredLogout: null,

    // Bind all document IDs into el
    init() {
      const ids = {
        restaurantNameDisplay: 'restaurant-name-display',
        brandLogoSvg: 'brand-logo-svg',
        brandLogoImg: 'brand-logo-img',
        liveClock: 'live-clock',
        liveDate: 'live-date',
        locationPill: 'location-pill',
        locationPillText: 'location-pill-text',
        punchSyncBadge: 'punch-sync-badge',
        punchSyncDot: 'punch-sync-dot',
        punchSyncText: 'punch-sync-text',
        headerUserBadge: 'header-user-badge',
        headerUserInitials: 'header-user-initials',
        headerUserImg: 'header-user-img',
        headerUserName: 'header-user-name',
        headerRolePill: 'header-role-pill',
        headerPlanPill: 'header-plan-pill',
        btnLogoutTrigger: 'btn-logout-trigger',
        btnOpenTeam: 'btn-open-team',
        btnOpenBilling: 'btn-open-billing',
        btnOpenHistory: 'btn-open-history',
        btnOpenSettings: 'btn-open-settings',
        headerDesktopNav: 'header-desktop-nav',
        mobileBottomNav: 'mobile-bottom-nav',
        mobileNavClock: 'mobile-nav-clock',
        mobileNavHistory: 'mobile-nav-history',
        mobileNavTeam: 'mobile-nav-team',
        mobileNavBilling: 'mobile-nav-billing',
        mobileNavSettings: 'mobile-nav-settings',
        screenLogin: 'screen-login',
        screenClockIn: 'screen-clockin',
        screenActiveShift: 'screen-active-shift',
        btnLoginTrigger: 'btn-login-trigger',
        btnSignupTrigger: 'btn-signup-trigger',
        sessionExpiredAlert: 'session-expired-alert',
        uninvitedUserAlert: 'uninvited-user-alert',
        uninvitedUserText: 'uninvited-user-text',
        googleSetupWarning: 'google-setup-warning',
        btnQuickSetup: 'btn-quick-setup',
        readyUserInitials: 'ready-user-initials',
        readyUserImg: 'ready-user-img',
        readyUserName: 'ready-user-name',
        readyUserEmail: 'ready-user-email',
        readyRoleBadge: 'ready-role-badge',
        readyPlanBadge: 'ready-plan-badge',
        readyScreenGreeting: 'ready-screen-greeting',
        btnClockInTrigger: 'btn-clockin-trigger',
        userName: 'active-user-name',
        userEmail: 'active-user-email',
        userAvatarInitials: 'user-avatar-initials',
        userAvatarImg: 'user-avatar-img',
        shiftClockInTime: 'shift-clockin-time',
        shiftDurationTimer: 'shift-duration-timer',
        shiftCoords: 'shift-coords',
        shiftAccuracy: 'shift-accuracy',
        shiftMapsLink: 'shift-maps-link',
        syncStatusBadge: 'sync-status-badge',
        syncStatusText: 'sync-status-text',
        btnClockOutTrigger: 'btn-clockout-trigger',
        loadingOverlay: 'loading-overlay',
        loadingTitle: 'loading-title',
        loadingSubtitle: 'loading-subtitle',
        confirmModal: 'confirm-modal',
        confirmTitle: 'confirm-title',
        confirmMessage: 'confirm-message',
        confirmIconContainer: 'confirm-icon-container',
        btnConfirmCancel: 'btn-confirm-cancel',
        btnConfirmOk: 'btn-confirm-ok',
        farewellModal: 'farewell-modal',
        farewellMessage: 'farewell-message',
        btnCloseFarewell: 'btn-close-farewell',
        settingsModal: 'settings-modal',
        btnCloseSettings: 'btn-close-settings',
        btnCancelSettings: 'btn-cancel-settings',
        btnSettingsLogout: 'btn-settings-logout',
        btnSaveSettings: 'btn-save-settings',
        inputRestaurantName: 'input-restaurant-name',
        inputSettingsBusinessType: 'input-settings-business-type',
        btnToggleSettingsBusinessType: 'btn-toggle-settings-business-type',
        listSettingsBusinessType: 'list-settings-business-type',
        arrowSettingsBusinessType: 'arrow-settings-business-type',
        inputRestaurantLogo: 'input-restaurant-logo',
        inputScriptUrl: 'input-sheet-id',
        inputSettingsTimezone: 'input-settings-timezone',
        settingsBillingSection: 'settings-billing-section',
        settingsSubBadge: 'settings-sub-badge',
        settingsSubPlan: 'settings-sub-plan',
        settingsSubExpiry: 'settings-sub-expiry',
        btnSettingsUpgrade: 'btn-settings-upgrade',
        settingsMobileSubNote: 'settings-mobile-sub-note',
        historyModal: 'history-modal',
        btnCloseHistory: 'btn-close-history',
        btnCloseHistoryBottom: 'btn-close-history-bottom',
        btnClearHistory: 'btn-clear-history',
        historyListContainer: 'history-list-container',
        onboardingModal: 'onboarding-modal',
        onboardTrialDesc: 'onboard-trial-desc',
        inputOnboardName: 'input-onboard-name',
        inputOnboardBusinessType: 'input-onboard-business-type',
        btnToggleOnboardBusinessType: 'btn-toggle-onboard-business-type',
        listOnboardBusinessType: 'list-onboard-business-type',
        arrowOnboardBusinessType: 'arrow-onboard-business-type',
        inputOnboardLogo: 'input-onboard-logo',
        inputOnboardAttendanceUrl: 'input-onboard-attendance-url',
        inputOnboardTimezone: 'input-onboard-timezone',
        btnCancelOnboard: 'btn-cancel-onboard',
        btnSaveOnboard: 'btn-save-onboard',
        teamModal: 'team-modal',
        btnCloseTeam: 'btn-close-team',
        btnCloseTeamBottom: 'btn-close-team-bottom',
        inputInviteEmail: 'input-team-email',
        inputInviteName: 'input-team-name',
        btnSendInvite: 'btn-submit-add-team',
        inviteStatusMsg: 'invite-status-msg',
        teamListContainer: 'team-list-container',
        billingModal: 'billing-modal',
        btnCloseBilling: 'btn-close-billing',
        billingStatusBanner: 'billing-current-status-banner',
        billingStatusTitle: 'billing-status-title',
        billingStatusDesc: 'billing-status-desc',
        billingStatusChip: 'billing-status-chip',
        billingCheckoutContainer: 'billing-checkout-container',
        billingPlatformNotice: 'billing-platform-notice',
        billingPlatformIcon: 'billing-platform-icon',
        billingPlatformTitle: 'billing-platform-title',
        billingPlatformBadge: 'billing-platform-badge',
        billingPlatformDesc: 'billing-platform-desc',
        btnCycleMonthly: 'btn-cycle-monthly',
        btnCycleYearly: 'btn-cycle-yearly',
        planCardStarter: 'plan-card-starter',
        planCardGrowth: 'plan-card-growth',
        planCardScale: 'plan-card-scale',
        planCheckStarter: 'plan-check-starter',
        planCheckGrowth: 'plan-check-growth',
        planCheckScale: 'plan-check-scale',
        planPriceStarter: 'plan-price-starter',
        planPriceGrowth: 'plan-price-growth',
        planPriceScale: 'plan-price-scale',
        planPeriodStarter: 'plan-period-starter',
        planPeriodGrowth: 'plan-period-growth',
        planPeriodScale: 'plan-period-scale',
        planSubtextStarter: 'plan-subtext-starter',
        planSubtextGrowth: 'plan-subtext-growth',
        planSubtextScale: 'plan-subtext-scale',
        featuresPlanTitle: 'features-plan-title',
        featuresTeamSize: 'features-team-size',
        featuresListContainer: 'features-list-container',
        billingChargeSummary: 'billing-charge-summary',
        formBillingPayment: 'form-billing-payment',
        inputCardName: 'input-card-name',
        inputCardNumber: 'input-card-number',
        inputCardExp: 'input-card-exp',
        inputCardCvc: 'input-card-cvc',
        inputCardZip: 'input-card-zip',
        billingErrorMsg: 'billing-error-msg',
        btnSubmitPayment: 'btn-submit-payment',
        btnSubmitPaymentText: 'btn-submit-payment-text',
        btnSubmitPaymentSpinner: 'btn-submit-payment-spinner',
        billingReceiptContainer: 'billing-receipt-container',
        receiptPlan: 'receipt-plan',
        receiptAmount: 'receipt-amount',
        receiptTxn: 'receipt-txn',
        btnFinishBilling: 'btn-finish-billing',
        billingCurrentStatusBanner: 'billing-current-status-banner',
        btnSimSuccess: 'btn-sim-success',
        btnSimDeclineFunds: 'btn-sim-decline-funds',
        btnSimDeclineExpired: 'btn-sim-decline-expired',
        btnSimRenewalFail: 'btn-sim-renewal-fail',
        btnSimResetTrial: 'btn-sim-reset-trial',
        trialExpiredModal: 'trial-expired-modal',
        expiredModalMsg: 'expired-modal-msg',
        expiredWebActions: 'expired-web-actions',
        btnExpiredUpgrade: 'btn-expired-upgrade',
        expiredMobileActions: 'expired-mobile-actions',
        btnExpiredLogout: 'btn-expired-logout'
      };

      for (const [key, id] of Object.entries(ids)) {
        this[key] = document.getElementById(id);
      }
    }
  };

  // Immediate binding if DOM is already ready, or on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => el.init());
  } else {
    el.init();
  }

  // --- UI SPINNERS & TOASTS ---
  function showLoading(title, subtitle) {
    if (el.loadingTitle) el.loadingTitle.textContent = title || 'Processing';
    if (el.loadingSubtitle) el.loadingSubtitle.textContent = subtitle || 'Please wait...';
    if (el.loadingOverlay) el.loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    if (el.loadingOverlay) el.loadingOverlay.classList.add('hidden');
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colorClasses = {
      info: 'bg-warmgray-900 text-white',
      success: 'bg-emerald-600 text-white',
      warning: 'bg-amber-600 text-white',
      error: 'bg-rose-600 text-white'
    }[type] || 'bg-warmgray-900 text-white';

    toast.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[110] px-4 py-2.5 rounded-2xl shadow-xl font-medium text-xs flex items-center gap-2 animate-fade-in transition-all ${colorClasses}`;
    toast.textContent = message;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, -10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- CUSTOM ASYNC CONFIRMATION MODAL ---
  function showConfirmDialog({
    title = 'Confirm',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'amber'
  } = {}) {
    return new Promise((resolve) => {
      if (!el.confirmModal) {
        return resolve(window.confirm(message));
      }

      if (el.confirmTitle) el.confirmTitle.textContent = title;
      if (el.confirmMessage) el.confirmMessage.textContent = message;

      if (el.btnConfirmOk) {
        el.btnConfirmOk.textContent = confirmText;
        if (type === 'rose') {
          el.btnConfirmOk.className = 'flex-1 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors btn-press touch-target';
          if (el.confirmIconContainer) {
            el.confirmIconContainer.className = 'w-14 h-14 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center';
            el.confirmIconContainer.innerHTML = '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
          }
        } else if (type === 'emerald') {
          el.btnConfirmOk.className = 'flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors btn-press touch-target';
          if (el.confirmIconContainer) {
            el.confirmIconContainer.className = 'w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center';
            el.confirmIconContainer.innerHTML = '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
          }
        } else {
          el.btnConfirmOk.className = 'flex-1 py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors btn-press touch-target';
          if (el.confirmIconContainer) {
            el.confirmIconContainer.className = 'w-14 h-14 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center';
            el.confirmIconContainer.innerHTML = '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
          }
        }
      }

      if (el.btnConfirmCancel) el.btnConfirmCancel.textContent = cancelText;

      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        el.confirmModal?.classList.add('hidden');
        el.btnConfirmOk?.removeEventListener('click', onOk);
        el.btnConfirmCancel?.removeEventListener('click', onCancel);
        el.confirmModal?.removeEventListener('click', onBackdrop);
      };

      const onOk = () => {
        if (typeof exports.triggerHaptic === 'function') exports.triggerHaptic();
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      const onBackdrop = (e) => {
        if (e.target === el.confirmModal) {
          cleanup();
          resolve(false);
        }
      };

      el.btnConfirmOk?.addEventListener('click', onOk);
      el.btnConfirmCancel?.addEventListener('click', onCancel);
      el.confirmModal?.addEventListener('click', onBackdrop);

      el.confirmModal.classList.remove('hidden');
    });
  }

  // Exports
  exports.el = el;
  exports.showLoading = showLoading;
  exports.hideLoading = hideLoading;
  exports.showToast = showToast;
  exports.showConfirmDialog = showConfirmDialog;

  // Global fallbacks
  window.el = el;
  window.showLoading = showLoading;
  window.hideLoading = hideLoading;
  window.showToast = showToast;
  window.showConfirmDialog = showConfirmDialog;

})(window.SheetPunch);
