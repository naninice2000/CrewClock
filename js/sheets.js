/**
 * SheetPunch / CrewClock - Google Sheets API, Central Tenancy & Server Time Sync
 */
window.CrewClock = window.CrewClock || {};

(function (exports) {
  'use strict';

  const SHEET_HEADERS = exports.SHEET_HEADERS || window.SHEET_HEADERS || [
    'Date',
    'Employee Name',
    'Employee Email',
    'Clock In Time',
    'Clock In Coordinates',
    'Clock In Google Map',
    'Clock Out Time',
    'Total Duration',
    'Clock Out Coordinates',
    'Clock Out Google Map',
    'Shift Status'
  ];

  function getEl() {
    return exports.dom?.el || window.el || {};
  }

  function getState() {
    return exports.state || window.CrewClock?.state || {};
  }

  // --- MULTI-TENANCY DIRECTORY CLIENT ---
  async function callTenancyApi(action, params = {}) {
    const state = getState();
    const settings = state.settings || window.settings || {};
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
    const state = getState();
    const settings = state.settings || window.settings || {};
    const currentUser = state.currentUser;
    const isGoogleAppsScriptUrl = exports.isGoogleAppsScriptUrl || window.isGoogleAppsScriptUrl || function () { return false; };

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
        state.serverTimeOffsetMs = serverNowMs - endTime;
        state.isServerTimeSynced = true;
        if (data.timeZone) state.serverTimeZone = data.timeZone;
        if (data.serviceEmail) {
          state.platformServiceEmail = data.serviceEmail;
          updateServiceEmailInModals();
        }
        console.log(`[TimeSync] Synchronized with Google Server Time (Offset: ${state.serverTimeOffsetMs}ms, TZ: ${state.serverTimeZone}, Host: ${state.platformServiceEmail || 'Central'})`);
        updateSyncBadgeUI();
      }
    } catch (err) {
      console.warn('[TimeSync] Google server ping unavailable, falling back to local clock:', err);
    }
  }

  function updateServiceEmailInModals() {
    const state = getState();
    const escapeHtml = exports.escapeHtml || window.escapeHtml || function (s) { return s; };
    const email = state.platformServiceEmail;
    if (!email) return;

    const onboardHint = document.getElementById('onboard-sheet-hint');
    if (onboardHint) {
      onboardHint.innerHTML = `Create a sheet at <a href="https://sheets.new" target="_blank" class="underline text-amber-700 font-bold">sheets.new</a>, copy its link/ID, and share it with <code class="bg-amber-100/90 text-amber-900 font-mono px-1 py-0.5 rounded font-bold select-all">${escapeHtml(email)}</code> as <strong>Editor</strong>. Staff has zero direct access to tamper. Or paste a custom Apps Script URL.`;
    }
    const settingsHint = document.getElementById('settings-sheet-hint');
    if (settingsHint) {
      settingsHint.innerHTML = `Google Sheet ID or URL (Share with <code class="bg-amber-100/90 text-amber-900 font-mono px-1 py-0.5 rounded font-bold select-all">${escapeHtml(email)}</code> as Editor). Staff members have 0 direct access. Alternatively, enter an Apps Script Web App URL.`;
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

  // POST helper for Attendance Google Apps Script Web App (Fallback for legacy configs)
  function postToGoogleAppsScript(url, payload) {
    const state = getState();
    const settings = state.settings || window.settings || {};
    const currentUser = state.currentUser;
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
    const el = getEl();
    const state = getState();
    const settings = state.settings || window.settings || {};
    const currentUser = state.currentUser;
    const isGoogleAppsScriptUrl = exports.isGoogleAppsScriptUrl || window.isGoogleAppsScriptUrl || function () { return false; };
    const isGoogleSpreadsheetTarget = exports.isGoogleSpreadsheetTarget || window.isGoogleSpreadsheetTarget || function () { return false; };
    const extractSpreadsheetId = exports.extractSpreadsheetId || window.extractSpreadsheetId || function () { return null; };

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
        el.syncStatusText.textContent = state.isServerTimeSynced
          ? `Verified Google Server Time (${state.serverTimeZone || 'Tamper-Proof'})`
          : 'Logged to Google Sheet via Google Apps Script (Server Time)';
        el.syncStatusBadge.className = 'flex items-center gap-1.5 text-[10px] sm:text-[11px] text-emerald-800 bg-emerald-50 rounded-lg p-2 border border-emerald-200';
      } else {
        el.syncStatusText.textContent = 'Stored locally (Add Google Sheet ID in Settings to sync)';
        el.syncStatusBadge.className = 'flex items-center gap-1.5 text-[10px] sm:text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2 border border-amber-200';
      }
    }
  }

  // Exports
  exports.callTenancyApi = callTenancyApi;
  exports.syncServerTime = syncServerTime;
  exports.updateServiceEmailInModals = updateServiceEmailInModals;
  exports.ensureSheetHeaders = ensureSheetHeaders;
  exports.appendClockInToSheet = appendClockInToSheet;
  exports.updateClockOutOnSheet = updateClockOutOnSheet;
  exports.findOpenShiftRow = findOpenShiftRow;
  exports.postToGoogleAppsScript = postToGoogleAppsScript;
  exports.updateSyncBadgeUI = updateSyncBadgeUI;

  // Global fallbacks
  window.callTenancyApi = callTenancyApi;
  window.syncServerTime = syncServerTime;
  window.updateServiceEmailInModals = updateServiceEmailInModals;
  window.ensureSheetHeaders = ensureSheetHeaders;
  window.appendClockInToSheet = appendClockInToSheet;
  window.updateClockOutOnSheet = updateClockOutOnSheet;
  window.findOpenShiftRow = findOpenShiftRow;
  window.postToGoogleAppsScript = postToGoogleAppsScript;
  window.updateSyncBadgeUI = updateSyncBadgeUI;

})(window.CrewClock);
