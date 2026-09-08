/**
 * SheetPunch - Application State Management
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

  // Base configuration loaded from config.js
  const fileConfig = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG : {};

  // Default Settings merging config.js and localStorage (with backwards compatibility for legacy keys)
  function loadInitialSettings() {
    try {
      const savedSettingsRaw = localStorage.getItem(STORAGE_KEYS.SETTINGS) || localStorage.getItem('crewclock_settings_v3') || '{}';
      const savedSettings = JSON.parse(savedSettingsRaw);
      const defaultOrgName = fileConfig.organizationName || fileConfig.businessName || fileConfig.restaurantName || 'Lightning Ventures LLC';
      return {
        businessName: savedSettings.businessName || savedSettings.restaurantName || defaultOrgName,
        restaurantName: savedSettings.businessName || savedSettings.restaurantName || defaultOrgName,
        businessType: savedSettings.businessType || 'Small & Medium Business',
        businessLogo: savedSettings.businessLogo || savedSettings.restaurantLogo || fileConfig.organizationLogo || fileConfig.businessLogo || fileConfig.restaurantLogo || '',
        restaurantLogo: savedSettings.businessLogo || savedSettings.restaurantLogo || fileConfig.organizationLogo || fileConfig.businessLogo || fileConfig.restaurantLogo || '',
        // Code-driven platform parameters (common to all tenants, cannot be modified by tenant admins):
        clientId: (fileConfig.googleClientId || '').trim(),
        tenancyScriptUrl: (fileConfig.tenancyScriptUrl || '').trim(),
        // Tenant attendance target:
        scriptUrl: savedSettings.scriptUrl || fileConfig.googleScriptUrl || '',
        // Optional Decoupled High-Throughput Buffer Endpoint:
        bufferEndpointUrl: (savedSettings.bufferEndpointUrl || fileConfig.bufferEndpointUrl || '').trim()
      };
    } catch (e) {
      console.warn('[State] Error parsing settings from localStorage:', e);
      return {
        businessName: 'Lightning Ventures LLC',
        restaurantName: 'Lightning Ventures LLC',
        businessType: 'Small & Medium Business',
        businessLogo: '',
        restaurantLogo: '',
        clientId: (fileConfig.googleClientId || '').trim(),
        tenancyScriptUrl: (fileConfig.tenancyScriptUrl || '').trim(),
        scriptUrl: fileConfig.googleScriptUrl || '',
        bufferEndpointUrl: (fileConfig.bufferEndpointUrl || '').trim()
      };
    }
  }

  function loadInitialActiveShift() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFT) || 'null');
    } catch (e) {
      return null;
    }
  }

  // Central Application State
  const state = {
    settings: loadInitialSettings(),
    currentUser: null,
    activeShift: loadInitialActiveShift(),
    tokenClient: null,
    currentAccessToken: null,
    shiftTimerInterval: null,
    platformServiceEmail: '',
    
    // Auth & Multi-Tenancy State
    authMode: 'signin', // 'signin' | 'signup'
    pendingAdminProfile: null,

    // Server Time Synchronization State (locks time to Google Server Time)
    serverTimeOffsetMs: 0,
    isServerTimeSynced: false,
    serverTimeZone: '',

    // Helper to reload settings from localStorage
    reloadSettings() {
      this.settings = loadInitialSettings();
      return this.settings;
    },

    // Helper to save settings
    saveSettings(newSettings) {
      this.settings = { ...this.settings, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
      } catch (e) {
        console.error('[State] Failed to persist settings:', e);
      }
      return this.settings;
    }
  };

  // Export state to namespace
  exports.state = state;

})(window.SheetPunch);
