/**
 * SheetPunch - Utility Helpers
 */
window.SheetPunch = window.SheetPunch || window.CrewClock || {};
window.CrewClock = window.SheetPunch;

(function (exports) {
  'use strict';

  // --- NATIVE MOBILE APP DETECTION ---
  function isNativeMobileApp() {
    if (typeof window !== 'undefined') {
      if (window.__SHEETPUNCH_NATIVE_APP__ === true || window.__CREWCLOCK_NATIVE_APP__ === true) return true;
      if (window.AndroidBridge !== undefined) return true;
      if (navigator.userAgent && /(SheetPunchApp|CrewClockApp)/i.test(navigator.userAgent)) return true;
    }
    return false;
  }

  function getPlatformName() {
    if (typeof window !== 'undefined') {
      if (window.__SHEETPUNCH_PLATFORM__ === 'ios' || window.__CREWCLOCK_PLATFORM__ === 'ios' || /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        return 'ios';
      }
      if (window.__SHEETPUNCH_PLATFORM__ === 'android' || window.__CREWCLOCK_PLATFORM__ === 'android' || /Android/i.test(navigator.userAgent) || window.AndroidBridge) {
        return 'android';
      }
    }
    return 'web';
  }

  // --- MOBILE HAPTIC FEEDBACK ---
  function triggerHaptic(type = 'light') {
    try {
      if (navigator.vibrate) {
        if (type === 'heavy') navigator.vibrate([30, 20, 30]);
        else if (type === 'medium') navigator.vibrate(20);
        else navigator.vibrate(10);
      }
    } catch (e) {
      // Haptics not supported or blocked by user gesture policy
    }
  }

  // --- TIME & DATE HELPERS ---
  function getNow() {
    const offset = exports.state?.serverTimeOffsetMs || 0;
    return new Date(Date.now() + offset);
  }

  function formatDateOnly(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
  }

  function formatDateTime(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    const time = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    return `${month} ${day}, ${year} ${time}`;
  }

  function formatDurationMs(ms) {
    if (isNaN(ms) || ms < 0) return '0h 00m';
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  // --- STRING & HTML HELPERS ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function safeEscapeHtml(str) {
    return escapeHtml(str);
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

  // --- SEARCHABLE DROPDOWN COMPONENT HELPER ---
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

  // Exports
  exports.isNativeMobileApp = isNativeMobileApp;
  exports.getPlatformName = getPlatformName;
  exports.triggerHaptic = triggerHaptic;
  exports.getNow = getNow;
  exports.formatDateOnly = formatDateOnly;
  exports.formatDateTime = formatDateTime;
  exports.formatDurationMs = formatDurationMs;
  exports.escapeHtml = escapeHtml;
  exports.safeEscapeHtml = safeEscapeHtml;
  exports.extractSpreadsheetId = extractSpreadsheetId;
  exports.isGoogleAppsScriptUrl = isGoogleAppsScriptUrl;
  exports.isGoogleSpreadsheetTarget = isGoogleSpreadsheetTarget;
  exports.initSearchableDropdown = initSearchableDropdown;

  // Global fallbacks
  window.isNativeMobileApp = isNativeMobileApp;
  window.triggerHaptic = triggerHaptic;
  window.getNow = getNow;
  window.escapeHtml = escapeHtml;
  window.safeEscapeHtml = safeEscapeHtml;
  window.extractSpreadsheetId = extractSpreadsheetId;
  window.isGoogleAppsScriptUrl = isGoogleAppsScriptUrl;

})(window.SheetPunch);
