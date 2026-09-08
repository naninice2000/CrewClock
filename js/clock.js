/**
 * SheetPunch - Live Clock, Shift Timer, Clock-In & Clock-Out Flows
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

  function getEl() {
    return exports.dom?.el || window.el || {};
  }

  function getState() {
    return exports.state || window.CrewClock?.state || {};
  }

  // --- LIVE CLOCK & DATE ---
  function startLiveClock() {
    const el = getEl();
    const getNow = exports.getNow || window.getNow || function () { return new Date(); };

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

  // --- SHIFT DURATION TIMER ---
  function startShiftDurationTimer(isoStartTime) {
    const state = getState();
    const el = getEl();
    const getNow = exports.getNow || window.getNow || function () { return new Date(); };

    if (state.shiftTimerInterval) {
      clearInterval(state.shiftTimerInterval);
      state.shiftTimerInterval = null;
    }

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
    state.shiftTimerInterval = setInterval(update, 1000);
  }

  function stopShiftDurationTimer() {
    const state = getState();
    if (state.shiftTimerInterval) {
      clearInterval(state.shiftTimerInterval);
      state.shiftTimerInterval = null;
    }
  }

  // --- CLOCK-IN FLOW (Optimistic UI + Jittered Background Queue) ---
  async function triggerClockIn() {
    const state = getState();
    const settings = state.settings || window.settings || {};
    const getUserSession = exports.getUserSession || window.getUserSession;
    const showTrialExpiredModal = exports.showTrialExpiredModal || window.showTrialExpiredModal || function () {};
    const isGoogleSpreadsheetTarget = exports.isGoogleSpreadsheetTarget || window.isGoogleSpreadsheetTarget || function () { return false; };
    const extractSpreadsheetId = exports.extractSpreadsheetId || window.extractSpreadsheetId || function () { return null; };
    const isGoogleAppsScriptUrl = exports.isGoogleAppsScriptUrl || window.isGoogleAppsScriptUrl || function () { return false; };
    const getDeviceLocation = exports.getDeviceLocation || window.getDeviceLocation;
    const getNow = exports.getNow || window.getNow || function () { return new Date(); };
    const formatDateTime = exports.formatDateTime || window.formatDateTime;
    const formatDateOnly = exports.formatDateOnly || window.formatDateOnly;
    const appendHistoryRecord = exports.appendHistoryRecord || window.appendHistoryRecord;
    const refreshScreenState = exports.refreshScreenState || window.refreshScreenState;
    const PunchQueueManager = exports.PunchQueueManager || window.PunchQueueManager;

    const session = typeof getUserSession === 'function' ? getUserSession() : null;
    if (!session) {
      alert('Your session has expired. Please sign in with Google.');
      if (typeof refreshScreenState === 'function') refreshScreenState();
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
      // 1. Capture exact GPS Geolocation at the click moment
      const location = await getDeviceLocation();

      // 2. Prepare timestamp & coordinates using server-synchronized time
      const now = getNow();
      const timestampStr = formatDateTime(now);
      const dateStr = formatDateOnly(now);
      const mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

      // 3. OPTIMISTIC UI: Save Active Shift immediately (0ms wait for the worker!)
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
        serverSynced: state.isServerTimeSynced || false,
        sheetRow: null,
        sheetTab: 'Attendance',
        sheetId: sheetId
      };

      state.activeShift = shiftData;
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(shiftData));
      if (typeof appendHistoryRecord === 'function') appendHistoryRecord(shiftData);

      // 4. Flip to Active Shift View immediately
      if (typeof refreshScreenState === 'function') refreshScreenState();

      // 5. Enqueue punch with Jitter for resilient background network delivery
      if (PunchQueueManager) {
        PunchQueueManager.enqueuePunch({
          id: shiftData.id,
          type: 'clockin',
          destination: (targetScriptUrl && isGoogleAppsScriptUrl(targetScriptUrl)) ? 'webhook' : 'tenancy',
          targetUrl: targetScriptUrl || '',
          payload: {
            tenantId: session.tenantId,
            email: session.email,
            name: session.name,
            latitude: location.latitude.toFixed(5),
            longitude: location.longitude.toFixed(5),
            accuracy: Math.round(location.accuracy),
            timestamp: timestampStr,
            clockInIso: now.toISOString()
          }
        });
      }

    } catch (err) {
      alert('Clock-In Notice: ' + err.message);
    }
  }

  // --- CLOCK-OUT FLOW (Optimistic UI + Jittered Background Queue) ---
  async function triggerClockOut() {
    const state = getState();
    const el = getEl();
    const activeShift = state.activeShift;
    if (!activeShift) return;

    const settings = state.settings || window.settings || {};
    const getUserSession = exports.getUserSession || window.getUserSession;
    const showConfirmDialog = exports.dom?.showConfirmDialog || window.showConfirmDialog;
    const isGoogleSpreadsheetTarget = exports.isGoogleSpreadsheetTarget || window.isGoogleSpreadsheetTarget || function () { return false; };
    const extractSpreadsheetId = exports.extractSpreadsheetId || window.extractSpreadsheetId || function () { return null; };
    const isGoogleAppsScriptUrl = exports.isGoogleAppsScriptUrl || window.isGoogleAppsScriptUrl || function () { return false; };
    const getDeviceLocation = exports.getDeviceLocation || window.getDeviceLocation;
    const getNow = exports.getNow || window.getNow || function () { return new Date(); };
    const formatDateTime = exports.formatDateTime || window.formatDateTime;
    const formatDateOnly = exports.formatDateOnly || window.formatDateOnly;
    const updateHistoryClockOut = exports.updateHistoryClockOut || window.updateHistoryClockOut;
    const refreshScreenState = exports.refreshScreenState || window.refreshScreenState;
    const PunchQueueManager = exports.PunchQueueManager || window.PunchQueueManager;

    const session = typeof getUserSession === 'function' ? getUserSession() : null;
    if (!session) {
      alert('Your session has expired. Please sign in again to complete clock-out.');
      if (typeof refreshScreenState === 'function') refreshScreenState();
      return;
    }

    const confirmed = await showConfirmDialog({
      title: 'Clock Out Now?',
      message: `Ready to finish your shift, ${activeShift.name}?\n\nYour end time and total hours worked will be recorded to your Google Sheet.`,
      confirmText: 'Yes, Clock Out',
      cancelText: 'Keep Working',
      type: 'amber'
    });
    if (!confirmed) return;

    const rawTarget = session.attendanceScriptUrl || settings.scriptUrl || '';
    const isSheetApi = isGoogleSpreadsheetTarget(rawTarget);
    const sheetId = isSheetApi ? (activeShift.sheetId || extractSpreadsheetId(rawTarget)) : null;
    const targetScriptUrl = !isSheetApi && isGoogleAppsScriptUrl(rawTarget) ? rawTarget : null;

    try {
      // 1. Capture exact GPS Geolocation at clock-out moment (resilient 8s attempt with shift coords fallback)
      let location;
      try {
        location = await getDeviceLocation(8000);
      } catch (locErr) {
        console.warn('Clock-out GPS acquisition warning, using fallback shift coordinates:', locErr);
        location = {
          latitude: parseFloat(activeShift.latitude) || 0,
          longitude: parseFloat(activeShift.longitude) || 0,
          accuracy: activeShift.accuracy ? Number(activeShift.accuracy) : 999,
          timestamp: Date.now(),
          isFallback: true
        };
      }

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

      // Snapshot active shift data for background punch and history
      const shiftSnapshot = { ...activeShift };

      // 2. Update Local History immediately
      if (typeof updateHistoryClockOut === 'function') {
        updateHistoryClockOut(shiftSnapshot.id, clockOutTimeStr, durationStr, location, outMapsUrl);
      }

      // 3. Reset active shift and interval immediately (Optimistic UI)
      stopShiftDurationTimer();
      state.activeShift = null;
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);

      // 4. Show farewell summary and flip UI immediately
      if (el.farewellMessage) {
        el.farewellMessage.textContent = `Great work today, ${shiftSnapshot.name}! You worked ${durationStr}. Your clock-out was recorded at ${clockOutTimeStr}.`;
      }
      if (el.farewellModal) el.farewellModal.classList.remove('hidden');
      if (typeof refreshScreenState === 'function') refreshScreenState();

      // 5. Enqueue Clock-Out punch with Jitter for background delivery
      if (PunchQueueManager) {
        PunchQueueManager.enqueuePunch({
          id: 'out_' + Date.now(),
          type: 'clockout',
          destination: (targetScriptUrl && isGoogleAppsScriptUrl(targetScriptUrl)) ? 'webhook' : 'tenancy',
          targetUrl: targetScriptUrl || '',
          payload: {
            tenantId: session.tenantId,
            email: shiftSnapshot.email,
            name: shiftSnapshot.name,
            sheetRow: shiftSnapshot.sheetRow,
            clockInDate: shiftSnapshot.clockInDate || formatDateOnly(now),
            clockInTime: shiftSnapshot.clockInTime,
            inCoords: `${shiftSnapshot.latitude}, ${shiftSnapshot.longitude}`,
            inMapsUrl: shiftSnapshot.mapsUrl,
            latitude: location.latitude.toFixed(5),
            longitude: location.longitude.toFixed(5),
            accuracy: Math.round(location.accuracy),
            timestamp: clockOutTimeStr,
            duration: durationStr,
            clockInIso: shiftSnapshot.clockInIso,
            clockOutIso: now.toISOString()
          }
        });
      }

    } catch (err) {
      alert('Clock-Out Notice: ' + err.message);
    }
  }

  // Exports
  exports.startLiveClock = startLiveClock;
  exports.startShiftDurationTimer = startShiftDurationTimer;
  exports.stopShiftDurationTimer = stopShiftDurationTimer;
  exports.triggerClockIn = triggerClockIn;
  exports.triggerClockOut = triggerClockOut;

  // Global fallbacks
  window.startLiveClock = startLiveClock;
  window.startShiftDurationTimer = startShiftDurationTimer;
  window.stopShiftDurationTimer = stopShiftDurationTimer;
  window.triggerClockIn = triggerClockIn;
  window.triggerClockOut = triggerClockOut;

})(window.SheetPunch);
