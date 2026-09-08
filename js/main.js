/**
 * SheetPunch - Application Bootstrap & Main Controller
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

  const BUSINESS_TYPES = exports.BUSINESS_TYPES || window.BUSINESS_TYPES || [];

  function getEl() {
    return exports.dom?.el || window.el || {};
  }

  function getState() {
    return exports.state || window.CrewClock?.state || {};
  }

  // --- BRAND & CONFIG DISPLAY ---
  function applyBrandSettings() {
    const el = getEl();
    const state = getState();
    const settings = state.settings || window.settings || {};
    const currentUser = state.currentUser;
    const fileConfig = window.SHEETPUNCH_CONFIG || window.CREWCLOCK_CONFIG || {};
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
    const el = getEl();
    const state = getState();
    const settings = state.settings || window.settings || {};
    if (!settings.clientId || settings.clientId.trim().length === 0) {
      if (el.googleSetupWarning) el.googleSetupWarning.classList.remove('hidden');
    } else {
      if (el.googleSetupWarning) el.googleSetupWarning.classList.add('hidden');
    }
  }

  // --- SETTINGS MODAL ---
  function openSettingsModal() {
    const el = getEl();
    const state = getState();
    const currentUser = state.currentUser;
    const settings = state.settings || window.settings || {};

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
          } catch (e) {}
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

  function closeSettingsModal() {
    const el = getEl();
    if (el.settingsModal) el.settingsModal.classList.add('hidden');
    setActiveMobileTab('shift');
  }

  // --- MOBILE BOTTOM DOCK ACTIVE TAB HIGHLIGHT ---
  function setActiveMobileTab(activeId) {
    const el = getEl();
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
    const state = getState();
    const getUserSession = exports.getUserSession || window.getUserSession;
    const updateHeaderUserUI = exports.updateHeaderUserUI || window.updateHeaderUserUI;
    const updateRoleBasedUI = exports.updateRoleBasedUI || window.updateRoleBasedUI;

    const session = typeof getUserSession === 'function' ? getUserSession() : state.currentUser;
    if (typeof updateHeaderUserUI === 'function') updateHeaderUserUI();
    if (typeof updateRoleBasedUI === 'function') updateRoleBasedUI();
    setActiveMobileTab('shift');

    if (!session) {
      showScreen('login');
      return;
    }

    const activeShift = state.activeShift;
    // If an active shift is in progress for this user, show active shift screen
    if (activeShift && activeShift.status === 'Clocked In' && activeShift.email.toLowerCase() === session.email.toLowerCase()) {
      showScreen('activeShift');
    } else {
      showScreen('clockIn');
    }
  }

  function showScreen(screen) {
    const el = getEl();
    const state = getState();

    if (el.screenLogin) el.screenLogin.classList.add('hidden');
    if (el.screenClockIn) el.screenClockIn.classList.add('hidden');
    if (el.screenActiveShift) el.screenActiveShift.classList.add('hidden');

    if (screen === 'login') {
      if (el.screenLogin) el.screenLogin.classList.remove('hidden');
      if (state.shiftTimerInterval) {
        clearInterval(state.shiftTimerInterval);
        state.shiftTimerInterval = null;
      }
    } else if (screen === 'clockIn') {
      populateReadyScreen(state.currentUser);
      if (el.screenClockIn) el.screenClockIn.classList.remove('hidden');
      if (state.shiftTimerInterval) {
        clearInterval(state.shiftTimerInterval);
        state.shiftTimerInterval = null;
      }
    } else if (screen === 'activeShift') {
      populateActiveShiftScreen(state.activeShift);
      if (el.screenActiveShift) el.screenActiveShift.classList.remove('hidden');
    }
  }

  function populateReadyScreen(user) {
    if (!user) return;
    const el = getEl();
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
        if (sub && sub.status === 'past_due') {
          el.readyPlanBadge.textContent = 'Renewal Failed (Past Due)';
          el.readyPlanBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse';
          el.readyPlanBadge.classList.remove('hidden');
        } else if (sub && sub.isPaid && sub.isValid) {
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
    const el = getEl();
    const updateSyncBadgeUI = exports.updateSyncBadgeUI || window.updateSyncBadgeUI;
    const startShiftDurationTimer = exports.startShiftDurationTimer || window.startShiftDurationTimer;
    const getNow = exports.getNow || window.getNow || function () { return new Date(); };

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

    if (typeof updateSyncBadgeUI === 'function') updateSyncBadgeUI();
    if (typeof startShiftDurationTimer === 'function') {
      startShiftDurationTimer(shift.clockInIso || getNow().toISOString());
    }
  }

  // --- EVENT LISTENERS ---
  function bindEvents() {
    const el = getEl();
    const state = getState();
    const settings = state.settings || window.settings || {};
    const triggerHaptic = exports.triggerHaptic || window.triggerHaptic || function () {};
    const triggerLogin = exports.triggerLogin || window.triggerLogin;
    const triggerLogout = exports.triggerLogout || window.triggerLogout;
    const openTeamModal = exports.openTeamModal || window.openTeamModal;
    const closeTeamModal = exports.closeTeamModal || window.closeTeamModal;
    const inviteTeamMember = exports.inviteTeamMember || window.inviteTeamMember;
    const triggerClockIn = exports.triggerClockIn || window.triggerClockIn;
    const triggerClockOut = exports.triggerClockOut || window.triggerClockOut;
    const renderHistoryModal = exports.renderHistoryModal || window.renderHistoryModal;
    const showConfirmDialog = exports.dom?.showConfirmDialog || window.showConfirmDialog;
    const closeOnboardingModal = exports.closeOnboardingModal || window.closeOnboardingModal;
    const submitOnboarding = exports.submitOnboarding || window.submitOnboarding;
    const openBillingModal = exports.openBillingModal || window.openBillingModal;
    const closeBillingModal = exports.closeBillingModal || window.closeBillingModal;
    const setBillingCycle = exports.setBillingCycle || window.setBillingCycle;
    const setPlanTier = exports.setPlanTier || window.setPlanTier;
    const handlePaymentSubmit = exports.handlePaymentSubmit || window.handlePaymentSubmit;
    const quickFillCard = exports.quickFillCard || window.quickFillCard;
    const simulateRenewalFailure = exports.simulateRenewalFailure || window.simulateRenewalFailure;
    const simulateResetTrial = exports.simulateResetTrial || window.simulateResetTrial;
    const closeTrialExpiredModal = exports.closeTrialExpiredModal || window.closeTrialExpiredModal;
    const extractSpreadsheetId = exports.extractSpreadsheetId || window.extractSpreadsheetId || function (s) { return s; };
    const callTenancyApi = exports.callTenancyApi || window.callTenancyApi;
    const syncServerTime = exports.syncServerTime || window.syncServerTime;
    const initSearchableDropdown = exports.initSearchableDropdown || window.initSearchableDropdown;
    const updateRoleBasedUI = exports.updateRoleBasedUI || window.updateRoleBasedUI;
    const PunchQueueManager = exports.PunchQueueManager || window.PunchQueueManager;

    // Sign-In with Google Trigger (Staff & Returning Admins)
    if (el.btnLoginTrigger) {
      el.btnLoginTrigger.addEventListener('click', () => {
        triggerHaptic();
        if (typeof triggerLogin === 'function') triggerLogin('signin');
      });
    }

    // Sign-Up with Google Trigger (Business Owners)
    if (el.btnSignupTrigger) {
      el.btnSignupTrigger.addEventListener('click', () => {
        triggerHaptic();
        if (typeof triggerLogin === 'function') triggerLogin('signup');
      });
    }

    // Header Logout Trigger
    if (el.btnLogoutTrigger) {
      el.btnLogoutTrigger.addEventListener('click', () => {
        triggerHaptic();
        if (typeof triggerLogout === 'function') triggerLogout();
      });
    }

    // Header Team Management Trigger (Admin only)
    if (el.btnOpenTeam) {
      el.btnOpenTeam.addEventListener('click', () => {
        triggerHaptic();
        if (typeof openTeamModal === 'function') openTeamModal();
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
        if (typeof triggerClockIn === 'function') triggerClockIn();
      });
    }

    // Clock-Out Button Trigger
    if (el.btnClockOutTrigger) {
      el.btnClockOutTrigger.addEventListener('click', () => {
        triggerHaptic();
        if (typeof triggerClockOut === 'function') triggerClockOut();
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
        if (typeof renderHistoryModal === 'function') renderHistoryModal();
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
      el.btnClearHistory.addEventListener('click', async () => {
        if (typeof showConfirmDialog !== 'function') return;
        const confirmed = await showConfirmDialog({
          title: 'Clear Local History?',
          message: 'Clear all local shift records from this device?\n\nThis will not delete any rows from your Google Sheet.',
          confirmText: 'Clear Records',
          cancelText: 'Keep Records',
          type: 'rose'
        });
        if (confirmed) {
          localStorage.removeItem(STORAGE_KEYS.HISTORY);
          if (typeof renderHistoryModal === 'function') renderHistoryModal();
        }
      });
    }

    // Onboarding Modal Events
    if (el.btnCancelOnboard) el.btnCancelOnboard.addEventListener('click', closeOnboardingModal);
    if (el.btnSaveOnboard) {
      el.btnSaveOnboard.addEventListener('click', () => {
        triggerHaptic();
        if (typeof submitOnboarding === 'function') submitOnboarding();
      });
    }

    // Team Management Modal Events
    if (el.btnCloseTeam) el.btnCloseTeam.addEventListener('click', closeTeamModal);
    if (el.btnCloseTeamBottom) el.btnCloseTeamBottom.addEventListener('click', closeTeamModal);
    const formAddTeam = document.getElementById('form-add-team-member');
    if (formAddTeam) {
      formAddTeam.addEventListener('submit', (e) => {
        e.preventDefault();
        triggerHaptic();
        if (typeof inviteTeamMember === 'function') inviteTeamMember();
      });
    }
    if (el.btnSendInvite) {
      el.btnSendInvite.addEventListener('click', (e) => {
        if (formAddTeam) e.preventDefault();
        triggerHaptic();
        if (typeof inviteTeamMember === 'function') inviteTeamMember();
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
    if (el.btnSettingsLogout) {
      el.btnSettingsLogout.addEventListener('click', () => {
        triggerHaptic();
        closeSettings();
        if (typeof triggerLogout === 'function') triggerLogout();
      });
    }

    if (el.btnSaveSettings) {
      el.btnSaveSettings.addEventListener('click', () => {
        const currentUser = state.currentUser;
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
          if (currentUser.role === 'admin' && settings.tenancyScriptUrl && typeof callTenancyApi === 'function') {
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
        if (typeof syncServerTime === 'function') syncServerTime();
        closeSettings();
        alert('Settings saved successfully!');
      });
    }

    // Initialize Searchable Business Type Dropdowns
    if (typeof initSearchableDropdown === 'function') {
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
    }

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
        if (typeof renderHistoryModal === 'function') renderHistoryModal();
        if (el.historyModal) el.historyModal.classList.remove('hidden');
      });
    }

    if (el.mobileNavTeam) {
      el.mobileNavTeam.addEventListener('click', () => {
        triggerHaptic();
        if (el.historyModal) el.historyModal.classList.add('hidden');
        if (el.settingsModal) el.settingsModal.classList.add('hidden');
        if (el.billingModal) el.billingModal.classList.add('hidden');

        const currentUser = state.currentUser;
        if (!currentUser) {
          alert('Team Management:\n\nPlease sign in with Google as a Business Admin to manage team members.');
          return;
        }
        if (currentUser.role !== 'admin') {
          alert('Team Management:\n\nOnly authorized business Admins can access Team Management.');
          return;
        }

        setActiveMobileTab('team');
        if (typeof openTeamModal === 'function') openTeamModal();
      });
    }

    if (el.mobileNavBilling) {
      el.mobileNavBilling.addEventListener('click', () => {
        triggerHaptic();
        if (el.historyModal) el.historyModal.classList.add('hidden');
        if (el.teamModal) el.teamModal.classList.add('hidden');
        if (el.settingsModal) el.settingsModal.classList.add('hidden');

        const currentUser = state.currentUser;
        if (!currentUser) {
          alert('Subscription & Billing:\n\nPlease sign in with Google as a Business Admin to manage your workspace subscription.');
          return;
        }
        if (currentUser.role !== 'admin') {
          alert('Subscription & Billing:\n\nOnly business administrators can manage subscription and billing.');
          return;
        }

        setActiveMobileTab('billing');
        if (typeof openBillingModal === 'function') openBillingModal();
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
        if (typeof openBillingModal === 'function') openBillingModal();
      });
    }
    if (el.btnCloseBilling) {
      el.btnCloseBilling.addEventListener('click', () => {
        if (typeof closeBillingModal === 'function') closeBillingModal();
        setActiveMobileTab('shift');
      });
    }
    if (el.btnSettingsUpgrade) {
      el.btnSettingsUpgrade.addEventListener('click', () => {
        triggerHaptic();
        closeSettings();
        if (typeof openBillingModal === 'function') openBillingModal();
      });
    }

    if (el.btnCycleMonthly) {
      el.btnCycleMonthly.addEventListener('click', () => {
        triggerHaptic();
        if (typeof setBillingCycle === 'function') setBillingCycle('monthly');
      });
    }
    if (el.btnCycleYearly) {
      el.btnCycleYearly.addEventListener('click', () => {
        triggerHaptic();
        if (typeof setBillingCycle === 'function') setBillingCycle('yearly');
      });
    }

    if (el.planCardStarter) {
      el.planCardStarter.addEventListener('click', () => {
        triggerHaptic();
        if (typeof setPlanTier === 'function') setPlanTier('starter');
      });
    }
    if (el.planCardGrowth) {
      el.planCardGrowth.addEventListener('click', () => {
        triggerHaptic();
        if (typeof setPlanTier === 'function') setPlanTier('growth');
      });
    }
    if (el.planCardScale) {
      el.planCardScale.addEventListener('click', () => {
        triggerHaptic();
        if (typeof setPlanTier === 'function') setPlanTier('scale');
      });
    }

    if (el.formBillingPayment) {
      el.formBillingPayment.addEventListener('submit', (e) => {
        triggerHaptic();
        if (typeof handlePaymentSubmit === 'function') handlePaymentSubmit(e);
      });
    }

    if (el.btnFinishBilling) {
      el.btnFinishBilling.addEventListener('click', () => {
        triggerHaptic();
        if (typeof closeBillingModal === 'function') closeBillingModal();
        setActiveMobileTab('shift');
        refreshScreenState();
      });
    }

    // Simulator Toolbar Events
    if (el.btnSimSuccess) {
      el.btnSimSuccess.addEventListener('click', () => {
        if (typeof quickFillCard === 'function') {
          quickFillCard('Jane Doe (Admin)', '4111 1111 1111 1111', '12/28', '123', '94103');
        }
      });
    }
    if (el.btnSimDeclineFunds) {
      el.btnSimDeclineFunds.addEventListener('click', () => {
        if (typeof quickFillCard === 'function') {
          quickFillCard('Jane Doe (Admin)', '4000 0000 0000 0002', '12/28', '123', '94103');
        }
      });
    }
    if (el.btnSimDeclineExpired) {
      el.btnSimDeclineExpired.addEventListener('click', () => {
        if (typeof quickFillCard === 'function') {
          quickFillCard('Jane Doe (Admin)', '4000 0000 0000 0003', '01/22', '123', '94103');
        }
      });
    }
    if (el.btnSimRenewalFail) {
      el.btnSimRenewalFail.addEventListener('click', () => {
        if (typeof simulateRenewalFailure === 'function') simulateRenewalFailure();
      });
    }
    if (el.btnSimResetTrial) {
      el.btnSimResetTrial.addEventListener('click', () => {
        if (typeof simulateResetTrial === 'function') simulateResetTrial();
      });
    }

    // Trial Expired Modal Events
    if (el.btnExpiredUpgrade) {
      el.btnExpiredUpgrade.addEventListener('click', () => {
        triggerHaptic();
        if (typeof closeTrialExpiredModal === 'function') closeTrialExpiredModal();
        if (typeof openBillingModal === 'function') openBillingModal();
      });
    }
    if (el.btnExpiredLogout) {
      el.btnExpiredLogout.addEventListener('click', () => {
        triggerHaptic();
        if (typeof closeTrialExpiredModal === 'function') closeTrialExpiredModal();
        if (typeof triggerLogout === 'function') triggerLogout();
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
      if (typeof updateRoleBasedUI === 'function') updateRoleBasedUI();
    });

    // Start Punch Queue processing on launch & on network reconnect
    if (PunchQueueManager) {
      PunchQueueManager.processQueue();
      window.addEventListener('online', () => {
        console.log('[Network] Device back online, processing punch queue...');
        PunchQueueManager.processQueue();
      });
    }
  }

  // --- INITIALIZATION ---
  function init() {
    const state = getState();
    const getUserSession = exports.getUserSession || window.getUserSession;
    const syncServerTime = exports.syncServerTime || window.syncServerTime;
    const startLiveClock = exports.startLiveClock || window.startLiveClock;
    const checkLocationCapability = exports.checkLocationCapability || window.checkLocationCapability;
    const initGoogleAuth = exports.initGoogleAuth || window.initGoogleAuth;

    if (typeof getUserSession === 'function') {
      state.currentUser = getUserSession();
    }
    applyBrandSettings();
    if (typeof syncServerTime === 'function') syncServerTime();
    if (typeof startLiveClock === 'function') startLiveClock();
    if (typeof checkLocationCapability === 'function') checkLocationCapability();
    updateSetupWarningVisibility();
    if (typeof initGoogleAuth === 'function') initGoogleAuth();
    bindEvents();
    refreshScreenState();

    // Re-check session on tab focus
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        if (typeof getUserSession === 'function') {
          state.currentUser = getUserSession();
        }
        refreshScreenState();
      }
    });
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exports
  exports.applyBrandSettings = applyBrandSettings;
  exports.updateSetupWarningVisibility = updateSetupWarningVisibility;
  exports.openSettingsModal = openSettingsModal;
  exports.closeSettingsModal = closeSettingsModal;
  exports.setActiveMobileTab = setActiveMobileTab;
  exports.refreshScreenState = refreshScreenState;
  exports.showScreen = showScreen;
  exports.populateReadyScreen = populateReadyScreen;
  exports.populateActiveShiftScreen = populateActiveShiftScreen;
  exports.bindEvents = bindEvents;
  exports.init = init;

  // Global fallbacks
  window.applyBrandSettings = applyBrandSettings;
  window.updateSetupWarningVisibility = updateSetupWarningVisibility;
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;
  window.setActiveMobileTab = setActiveMobileTab;
  window.refreshScreenState = refreshScreenState;
  window.showScreen = showScreen;
  window.populateReadyScreen = populateReadyScreen;
  window.populateActiveShiftScreen = populateActiveShiftScreen;
  window.init = init;

})(window.SheetPunch);
