/**
 * SheetPunch - Shift History Management
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

  function getShiftHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
    } catch (e) {
      console.warn('[History] Error reading history from storage:', e);
      return [];
    }
  }

  function appendHistoryRecord(record) {
    const history = getShiftHistory();
    history.unshift(record);
    if (history.length > 50) history.pop();
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  }

  function updateHistoryClockOut(shiftId, clockOutTime, duration, outLocation, outMapsUrl) {
    const state = getState();
    const history = getShiftHistory();
    const record = history.find(item => item.id === shiftId || (item.email === state.activeShift?.email && item.status === 'Clocked In'));
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
    const el = getEl();
    if (!el.historyListContainer) return;
    const history = getShiftHistory();
    const escapeHtml = exports.escapeHtml || window.escapeHtml || function (s) { return s; };
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

  function openHistoryModal() {
    const el = getEl();
    renderHistoryModal();
    if (el.historyModal) el.historyModal.classList.remove('hidden');
  }

  function closeHistoryModal() {
    const el = getEl();
    if (el.historyModal) el.historyModal.classList.add('hidden');
  }

  async function clearShiftHistory() {
    const showConfirmDialog = exports.dom?.showConfirmDialog || window.showConfirmDialog;
    const confirmed = await showConfirmDialog({
      title: 'Clear Local History?',
      message: 'This clears shift logs saved on this device. Your data in Google Sheets is not affected.',
      confirmText: 'Clear History',
      cancelText: 'Keep',
      type: 'rose'
    });
    if (confirmed) {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      renderHistoryModal();
    }
  }

  // Exports
  exports.getShiftHistory = getShiftHistory;
  exports.appendHistoryRecord = appendHistoryRecord;
  exports.updateHistoryClockOut = updateHistoryClockOut;
  exports.renderHistoryModal = renderHistoryModal;
  exports.openHistoryModal = openHistoryModal;
  exports.closeHistoryModal = closeHistoryModal;
  exports.clearShiftHistory = clearShiftHistory;

  // Global fallbacks
  window.getShiftHistory = getShiftHistory;
  window.appendHistoryRecord = appendHistoryRecord;
  window.updateHistoryClockOut = updateHistoryClockOut;
  window.renderHistoryModal = renderHistoryModal;
  window.openHistoryModal = openHistoryModal;
  window.closeHistoryModal = closeHistoryModal;
  window.clearShiftHistory = clearShiftHistory;

})(window.SheetPunch);
