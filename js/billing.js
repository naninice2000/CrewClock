/**
 * SheetPunch - Subscription & Billing
 * Dual-Platform: Web direct pricing vs Mobile App Store +15% fee,
 * plan selection, card validation, sandbox simulator suite, trial expiry lock.
 */
window.SheetPunch = window.SheetPunch || window.CrewClock || {};
window.CrewClock = window.SheetPunch;

(function (exports) {
  'use strict';

  const PRICING_PLANS = exports.PRICING_PLANS || window.PRICING_PLANS || {};

  function getEl() {
    return exports.dom?.el || window.el || {};
  }

  function getState() {
    return exports.state || window.CrewClock?.state || {};
  }

  function isMobileBillingEnvironment() {
    const isNative = exports.isNativeMobileApp || window.isNativeMobileApp;
    if (typeof isNative === 'function' && isNative()) return true;
    if (typeof window !== 'undefined' && window.innerWidth < 768) return true;
    return false;
  }

  function getPlanRates(tierKey, isMobile = isMobileBillingEnvironment()) {
    const plans = exports.PRICING_PLANS || window.PRICING_PLANS || PRICING_PLANS;
    const plan = plans[tierKey] || plans.starter;
    if (!plan) return {};
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
    const plans = exports.PRICING_PLANS || window.PRICING_PLANS || PRICING_PLANS;
    if (plans[tier]) {
      selectedPlanTier = tier;
      updateBillingUI();
    }
  }

  function updateBillingUI() {
    const el = getEl();
    const plans = exports.PRICING_PLANS || window.PRICING_PLANS || PRICING_PLANS;
    const isYearly = selectedBillingCycle === 'yearly';
    const isMobile = isMobileBillingEnvironment();
    const escapeHtml = exports.escapeHtml || window.escapeHtml || function (s) { return s; };

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
          el.billingPlatformDesc.innerHTML = 'Prices reflect Apple App Store &amp; Google Play store processing fees. <b>Tip:</b> You can also subscribe on our web portal at <a href="https://sheetpunch.com" target="_blank" class="text-amber-700 underline font-semibold">sheetpunch.com</a> for direct base rates ($9.99/mo).';
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
      const plan = plans[t];
      if (!plan) return;
      const rates = getPlanRates(t, isMobile);
      const capT = t.charAt(0).toUpperCase() + t.slice(1);
      const priceEl = el[`planPrice${capT}`];
      const origPriceEl = el[`planOriginal${capT}`];
      const periodEl = el[`planPeriod${capT}`];
      const subtextEl = el[`planSubtext${capT}`];
      const cardEl = el[`planCard${capT}`];
      const checkEl = el[`planCheck${capT}`];

      if (priceEl) priceEl.textContent = isYearly ? rates.yearlyPriceFormatted : rates.monthlyPriceFormatted;
      if (origPriceEl) {
        origPriceEl.textContent = isYearly ? (rates.originalYearlyPriceFormatted || '$190') : (rates.originalMonthlyPriceFormatted || '$19');
      }
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
    const currentPlan = plans[selectedPlanTier] || plans.starter;
    const currentRates = getPlanRates(selectedPlanTier, isMobile);
    if (currentPlan) {
      if (el.featuresPlanTitle) el.featuresPlanTitle.textContent = `${currentPlan.name} Core Features`;
      if (el.featuresTeamSize) el.featuresTeamSize.textContent = currentPlan.teamSize;
      if (el.featuresListContainer && currentPlan.features) {
        el.featuresListContainer.innerHTML = currentPlan.features.map(feat => `
          <div class="flex items-center gap-1.5 text-warmgray-700">
            <span class="text-emerald-600 font-bold flex-shrink-0">✓</span>
            <span class="truncate">${escapeHtml(feat)}</span>
          </div>
        `).join('');
      }
    }

    // 4. Charge Summary & Submit Button Text
    const currentPrice = isYearly ? currentRates.yearlyPriceFormatted : currentRates.monthlyPriceFormatted;
    const cycleLabel = isYearly ? 'Annual' : 'Monthly';
    if (el.billingChargeSummary) {
      el.billingChargeSummary.textContent = `Charge: ${currentPrice}`;
    }
    if (el.btnSubmitPaymentText && (!el.btnSubmitPaymentSpinner || el.btnSubmitPaymentSpinner.classList.contains('hidden'))) {
      el.btnSubmitPaymentText.textContent = `Pay ${currentPrice} & Activate ${currentPlan?.name || 'Plan'} (${cycleLabel})`;
    }
  }

  function openBillingModal() {
    const el = getEl();
    const state = getState();
    const currentUser = state.currentUser;

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
      const isPastDue = sub.status === 'past_due';

      if (el.billingCurrentStatusBanner) {
        if (isPastDue) {
          el.billingCurrentStatusBanner.className = 'mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200/90 flex items-center justify-between gap-2';
        } else {
          el.billingCurrentStatusBanner.className = 'mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 flex items-center justify-between gap-2';
        }
      }

      if (el.billingStatusTitle) {
        if (isPastDue) {
          el.billingStatusTitle.textContent = 'Renewal Payment Failed';
        } else {
          el.billingStatusTitle.textContent = sub.plan || '14-Day Free Trial';
        }
      }

      if (el.billingStatusDesc) {
        const days = typeof sub.daysRemaining === 'number' ? sub.daysRemaining : 0;
        if (isPastDue) {
          el.billingStatusDesc.textContent = 'Your monthly recurring renewal charge failed. Please update payment details below to restore access.';
        } else if (sub.isPaid && sub.isValid) {
          el.billingStatusDesc.textContent = `Subscription active with ${days} day${days === 1 ? '' : 's'} remaining`;
        } else if (sub.isTrial && sub.isValid) {
          const startDateStr = sub.createdAt ? new Date(sub.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
          const startPrefix = startDateStr ? `Started ${startDateStr} • ` : '';
          el.billingStatusDesc.textContent = `${startPrefix}${days} day${days === 1 ? '' : 's'} left in your free trial`;
        } else {
          el.billingStatusDesc.textContent = 'Your 14-day free trial has expired. Select a plan below to continue.';
        }
      }

      if (el.billingStatusChip) {
        if (isPastDue) {
          el.billingStatusChip.textContent = 'Past Due';
          el.billingStatusChip.className = 'px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-xs border border-rose-200 flex-shrink-0 animate-pulse';
        } else if (sub.isPaid && sub.isValid) {
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
    const el = getEl();
    if (el.billingModal) el.billingModal.classList.add('hidden');
    const setActiveMobileTab = exports.setActiveMobileTab || window.setActiveMobileTab;
    if (typeof setActiveMobileTab === 'function') setActiveMobileTab('shift');
  }

  async function handlePaymentSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const el = getEl();
    const state = getState();
    const currentUser = state.currentUser;
    const plans = exports.PRICING_PLANS || window.PRICING_PLANS || PRICING_PLANS;
    const callTenancyApi = exports.callTenancyApi || window.callTenancyApi;
    const saveUserSession = exports.saveUserSession || window.saveUserSession;
    const refreshScreenState = exports.refreshScreenState || window.refreshScreenState;
    const isNativeMobileApp = exports.isNativeMobileApp || window.isNativeMobileApp || function () { return false; };

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
      // 1. SIMULATION DECLINE CHECKS
      if (cardNumber.endsWith('0002') || cardNumber === '4000000000000002') {
        throw new Error('Payment declined: Insufficient funds in the account. (code: declined_insufficient_funds)');
      }
      if (cardNumber.endsWith('0003') || cardNumber === '4000000000000003') {
        throw new Error('Payment declined: Card has expired. Please check expiry date. (code: declined_expired_card)');
      }
      if (cardNumber.endsWith('0004') || cardCvc === '999') {
        throw new Error('Payment declined: Incorrect CVV / security code. (code: declined_cvv)');
      }
      if (cardNumber.endsWith('0005')) {
        throw new Error('Payment declined by issuing bank (Do Not Honor). (code: declined_do_not_honor)');
      }

      // Simulate a realistic gateway response delay (600ms)
      await new Promise(resolve => setTimeout(resolve, 600));

      const isMobile = isMobileBillingEnvironment();
      const planConfig = plans[selectedPlanTier] || plans.starter;
      const planRates = getPlanRates(selectedPlanTier, isMobile);
      const isYearly = selectedBillingCycle === 'yearly';
      const planName = `${planConfig.name} (${isYearly ? 'Annual' : 'Monthly'})`;
      const paidAmount = isYearly ? planRates.yearlyPriceFormatted : planRates.monthlyPriceFormatted;
      const durationDays = isYearly ? 365 : 30;
      const paymentRef = 'PAY_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const platformName = isNativeMobileApp()
        ? (navigator.userAgent && /iPhone|iPad/i.test(navigator.userAgent) ? 'ios_app' : 'android_app')
        : (isMobile ? 'mobile_web' : 'web');

      let res = { success: true };
      try {
        if (typeof callTenancyApi === 'function') {
          const syncRes = await callTenancyApi('record_payment', {
            adminEmail: currentUser.email,
            tenantId: currentUser.tenantId,
            plan: planName,
            billingCycle: selectedBillingCycle,
            paidAmount: paidAmount,
            paymentRef: paymentRef,
            durationDays: durationDays,
            platform: platformName
          });
          if (syncRes && syncRes.success) {
            res = syncRes;
          }
        }
      } catch (syncErr) {
        console.warn('Tenancy sync fallback (offline or pending script deployment):', syncErr.message);
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
      if (typeof saveUserSession === 'function') saveUserSession(currentUser);
      if (typeof refreshScreenState === 'function') refreshScreenState();

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

  // --- SIMULATION SUITE HELPERS ---
  function quickFillCard(name, number, exp, cvc, zip) {
    const el = getEl();
    const triggerHaptic = exports.triggerHaptic || window.triggerHaptic || function () {};
    triggerHaptic();
    if (el.inputCardName) el.inputCardName.value = name;
    if (el.inputCardNumber) el.inputCardNumber.value = number;
    if (el.inputCardExp) el.inputCardExp.value = exp;
    if (el.inputCardCvc) el.inputCardCvc.value = cvc;
    if (el.inputCardZip) el.inputCardZip.value = zip;
    if (el.billingErrorMsg) {
      el.billingErrorMsg.textContent = '';
      el.billingErrorMsg.classList.add('hidden');
    }
  }

  function simulateRenewalFailure() {
    const el = getEl();
    const state = getState();
    const currentUser = state.currentUser;
    const triggerHaptic = exports.triggerHaptic || window.triggerHaptic || function () {};
    const saveUserSession = exports.saveUserSession || window.saveUserSession;
    const refreshScreenState = exports.refreshScreenState || window.refreshScreenState;

    if (!currentUser) return;
    triggerHaptic();
    const currentPlanName = currentUser.subscription?.plan || 'Pro Crew (Monthly)';
    currentUser.subscription = {
      status: 'past_due',
      plan: currentPlanName,
      billingCycle: 'monthly',
      isTrial: false,
      isPaid: false,
      isValid: false,
      daysRemaining: 0,
      subscriptionEndsAt: new Date(Date.now() - 86400000).toISOString(),
      paidAmount: '$24.99',
      paymentRef: 'RENEWAL_FAIL_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      failureReason: 'declined_insufficient_funds'
    };
    if (typeof saveUserSession === 'function') saveUserSession(currentUser);
    if (typeof refreshScreenState === 'function') refreshScreenState();
    openBillingModal();
    if (el.billingErrorMsg) {
      el.billingErrorMsg.textContent = '⚠️ Simulated Renewal Failure: Monthly recurring charge could not be processed. Workspace marked Past Due.';
      el.billingErrorMsg.classList.remove('hidden');
    }
  }

  function simulateResetTrial() {
    const el = getEl();
    const state = getState();
    const currentUser = state.currentUser;
    const triggerHaptic = exports.triggerHaptic || window.triggerHaptic || function () {};
    const saveUserSession = exports.saveUserSession || window.saveUserSession;
    const refreshScreenState = exports.refreshScreenState || window.refreshScreenState;

    if (!currentUser) return;
    triggerHaptic();
    const trialDays = 14;
    const now = Date.now();
    currentUser.subscription = {
      status: 'trial',
      plan: '14-Day Free Trial',
      billingCycle: 'trial',
      isTrial: true,
      isPaid: false,
      isValid: true,
      daysRemaining: trialDays,
      trialEndsAt: new Date(now + trialDays * 86400000).toISOString(),
      subscriptionEndsAt: new Date(now + trialDays * 86400000).toISOString(),
      paidAmount: '$0.00',
      paymentRef: ''
    };
    if (typeof saveUserSession === 'function') saveUserSession(currentUser);
    if (typeof refreshScreenState === 'function') refreshScreenState();
    openBillingModal();
    if (el.billingErrorMsg) {
      el.billingErrorMsg.textContent = '';
      el.billingErrorMsg.classList.add('hidden');
    }
    alert('Workspace subscription reset to active 14-day free trial!');
  }

  // --- TRIAL EXPIRED MODAL ---
  function showTrialExpiredModal() {
    const el = getEl();
    const state = getState();
    const currentUser = state.currentUser;
    const isNativeMobileApp = exports.isNativeMobileApp || window.isNativeMobileApp || function () { return false; };
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
    const el = getEl();
    if (el.trialExpiredModal) el.trialExpiredModal.classList.add('hidden');
  }

  // Exports
  exports.isMobileBillingEnvironment = isMobileBillingEnvironment;
  exports.getPlanRates = getPlanRates;
  exports.setBillingCycle = setBillingCycle;
  exports.setPlanTier = setPlanTier;
  exports.updateBillingUI = updateBillingUI;
  exports.openBillingModal = openBillingModal;
  exports.closeBillingModal = closeBillingModal;
  exports.handlePaymentSubmit = handlePaymentSubmit;
  exports.quickFillCard = quickFillCard;
  exports.simulateRenewalFailure = simulateRenewalFailure;
  exports.simulateResetTrial = simulateResetTrial;
  exports.showTrialExpiredModal = showTrialExpiredModal;
  exports.closeTrialExpiredModal = closeTrialExpiredModal;

  // Global fallbacks
  window.isMobileBillingEnvironment = isMobileBillingEnvironment;
  window.getPlanRates = getPlanRates;
  window.setBillingCycle = setBillingCycle;
  window.setPlanTier = setPlanTier;
  window.updateBillingUI = updateBillingUI;
  window.openBillingModal = openBillingModal;
  window.closeBillingModal = closeBillingModal;
  window.handlePaymentSubmit = handlePaymentSubmit;
  window.quickFillCard = quickFillCard;
  window.simulateRenewalFailure = simulateRenewalFailure;
  window.simulateResetTrial = simulateResetTrial;
  window.showTrialExpiredModal = showTrialExpiredModal;
  window.closeTrialExpiredModal = closeTrialExpiredModal;

})(window.SheetPunch);
