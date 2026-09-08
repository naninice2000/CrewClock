/**
 * SheetPunch - Business Onboarding (Signup Flow)
 */
window.SheetPunch = window.SheetPunch || window.CrewClock || {};
window.CrewClock = window.SheetPunch;

(function (exports) {
  'use strict';

  function getEl() {
    return exports.dom?.el || window.el || {};
  }

  function getState() {
    return exports.state || window.CrewClock?.state || {};
  }

  function openOnboardingModal() {
    const el = getEl();
    const state = getState();
    const settings = state.settings || window.settings || {};
    const isNativeMobileApp = exports.isNativeMobileApp || window.isNativeMobileApp || function () { return false; };

    if (!state.pendingAdminProfile) return;
    if (el.inputOnboardName) el.inputOnboardName.value = '';
    if (el.inputOnboardBusinessType) el.inputOnboardBusinessType.value = '';
    if (el.inputOnboardLogo) el.inputOnboardLogo.value = '';
    if (el.inputOnboardAttendanceUrl) el.inputOnboardAttendanceUrl.value = settings.scriptUrl || '';

    if (el.onboardTrialDesc) {
      if (isNativeMobileApp()) {
        el.onboardTrialDesc.textContent = 'Every new business workspace gets 2 weeks of full free trial access. After your trial, continuing your subscription is handled securely via our Web Portal at sheetpunch.com (subscription purchase is not available inside mobile apps).';
      } else {
        el.onboardTrialDesc.textContent = 'Every new business workspace gets 2 weeks of full free trial access. After your trial, continuing your subscription is handled securely via the Web Portal.';
      }
    }
    if (el.onboardingModal) el.onboardingModal.classList.remove('hidden');
  }

  function closeOnboardingModal() {
    const el = getEl();
    const state = getState();
    if (el.onboardingModal) el.onboardingModal.classList.add('hidden');
    state.pendingAdminProfile = null;
  }

  async function submitOnboarding() {
    const el = getEl();
    const state = getState();
    const pendingAdminProfile = state.pendingAdminProfile;
    const showLoading = exports.dom?.showLoading || window.showLoading || function () {};
    const hideLoading = exports.dom?.hideLoading || window.hideLoading || function () {};
    const extractSpreadsheetId = exports.extractSpreadsheetId || window.extractSpreadsheetId || function (s) { return s; };
    const callTenancyApi = exports.callTenancyApi || window.callTenancyApi;
    const saveUserSession = exports.saveUserSession || window.saveUserSession;
    const syncServerTime = exports.syncServerTime || window.syncServerTime;
    const refreshScreenState = exports.refreshScreenState || window.refreshScreenState;

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
      if (typeof callTenancyApi !== 'function') throw new Error('Tenancy client is unavailable.');

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
      if (typeof saveUserSession === 'function') {
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
          accessToken: state.currentAccessToken
        });
      }

      closeOnboardingModal();
      hideLoading();
      if (typeof syncServerTime === 'function') syncServerTime();
      if (typeof refreshScreenState === 'function') refreshScreenState();

      setTimeout(() => {
        alert(`🎉 Welcome to SheetPunch, ${adminName}!\n\nWorkspace "${businessName}" is ready. You can now invite staff to sign in using the Team icon in the top header.`);
      }, 100);
    } catch (err) {
      hideLoading();
      alert('Onboarding Error: ' + err.message);
    }
  }

  // Exports
  exports.openOnboardingModal = openOnboardingModal;
  exports.closeOnboardingModal = closeOnboardingModal;
  exports.submitOnboarding = submitOnboarding;

  // Global fallbacks
  window.openOnboardingModal = openOnboardingModal;
  window.closeOnboardingModal = closeOnboardingModal;
  window.submitOnboarding = submitOnboarding;

})(window.SheetPunch);
