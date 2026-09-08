/**
 * SheetPunch - Offline Punch Queue Manager
 * Provides Optimistic UI, background delivery with randomized jitter & exponential backoff.
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

  const PunchQueueManager = (() => {
    let isProcessing = false;
    let syncHideTimeout = null;

    function getQueue() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.PUNCH_QUEUE) || localStorage.getItem('crewclock_punch_queue');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    function saveQueue(queue) {
      try {
        localStorage.setItem(STORAGE_KEYS.PUNCH_QUEUE, JSON.stringify(queue));
      } catch (e) {
        console.warn('[Queue] Storage error:', e);
      }
    }

    function updateSyncBadge(state, message) {
      const el = getEl();
      if (!el.punchSyncBadge) return;
      el.punchSyncBadge.classList.remove('hidden', 'sync-badge-syncing', 'sync-badge-synced', 'sync-badge-queued');

      if (state === 'syncing') {
        el.punchSyncBadge.classList.add('sync-badge-syncing');
        if (el.punchSyncText) el.punchSyncText.textContent = message || '⟳ Syncing...';
      } else if (state === 'synced') {
        el.punchSyncBadge.classList.add('sync-badge-synced');
        if (el.punchSyncText) el.punchSyncText.textContent = message || '✓ Cloud Synced';
        clearTimeout(syncHideTimeout);
        syncHideTimeout = setTimeout(() => {
          if (getQueue().length === 0 && el.punchSyncBadge) {
            el.punchSyncBadge.classList.add('hidden');
          }
        }, 4000);
      } else if (state === 'queued') {
        el.punchSyncBadge.classList.add('sync-badge-queued');
        if (el.punchSyncText) el.punchSyncText.textContent = message || '⚡ Saved Offline (Syncing)';
      } else {
        el.punchSyncBadge.classList.add('hidden');
      }
    }

    function enqueuePunch(punch) {
      const queue = getQueue();
      const jitterMs = Math.floor(Math.random() * 2000 + 500); // 500ms - 2500ms jitter
      const item = {
        id: punch.id || ('punch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
        type: punch.type, // 'clockin' | 'clockout'
        destination: punch.destination, // 'buffer' | 'webhook' | 'tenancy'
        targetUrl: punch.targetUrl || '',
        payload: punch.payload,
        attempts: 0,
        nextAttemptAt: Date.now() + jitterMs,
        createdAt: Date.now()
      };
      queue.push(item);
      saveQueue(queue);

      updateSyncBadge('syncing', '⟳ Syncing in background...');
      scheduleQueueFlush(jitterMs);
      return item;
    }

    function scheduleQueueFlush(delayMs) {
      const delay = (typeof delayMs === 'number') ? delayMs : Math.floor(Math.random() * 1500 + 500);
      setTimeout(() => {
        processQueue();
      }, delay);
    }

    async function processQueue() {
      if (isProcessing) return;
      const queue = getQueue();
      if (queue.length === 0) {
        return;
      }

      const now = Date.now();
      const readyIdx = queue.findIndex(item => !item.nextAttemptAt || item.nextAttemptAt <= now);
      if (readyIdx === -1) {
        const nextTime = Math.min(...queue.map(i => i.nextAttemptAt || 0));
        const wait = Math.max(500, nextTime - now);
        setTimeout(() => processQueue(), wait);
        return;
      }

      isProcessing = true;
      const item = queue[readyIdx];
      updateSyncBadge('syncing', `⟳ Syncing ${item.type === 'clockin' ? 'Clock-In' : 'Clock-Out'}...`);

      const state = getState();
      const settings = state.settings || window.settings || {};
      const currentUser = state.currentUser;
      const postToGoogleAppsScript = exports.postToGoogleAppsScript || window.postToGoogleAppsScript;
      const callTenancyApi = exports.callTenancyApi || window.callTenancyApi;
      const saveUserSession = exports.saveUserSession || window.saveUserSession;
      const showTrialExpiredModal = exports.showTrialExpiredModal || window.showTrialExpiredModal || function () {};

      try {
        let success = false;

        // Path 1: Decoupled High-Throughput Buffer Service (if configured)
        if (settings.bufferEndpointUrl && settings.bufferEndpointUrl.trim().length > 0) {
          try {
            const bufRes = await fetch(settings.bufferEndpointUrl.replace(/\/+$/, '') + '/api/v1/punch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                punchId: item.id,
                type: item.type,
                ...item.payload
              })
            });
            if (bufRes.status === 429) throw new Error('HTTP 429: Buffer Rate Limit');
            if (bufRes.ok) {
              success = true;
            }
          } catch (bufErr) {
            console.warn('[Queue] Buffer service unavailable, falling back to direct route:', bufErr);
          }
        }

        // Path 2: Direct Customer Apps Script Webhook (Choice B)
        if (!success && item.destination === 'webhook' && item.targetUrl) {
          if (typeof postToGoogleAppsScript === 'function') {
            await postToGoogleAppsScript(item.targetUrl, {
              action: item.type,
              ...item.payload
            });
            success = true;
          }
        }

        // Path 3: Central Tenancy Script Proxy (Choice A)
        if (!success && settings.tenancyScriptUrl && typeof callTenancyApi === 'function') {
          const res = await callTenancyApi('log_shift', {
            subAction: item.type,
            tenantId: item.payload.tenantId,
            email: item.payload.email,
            ...item.payload
          });
          if (res && res.success) {
            success = true;
            if (item.type === 'clockin' && res.rowNumber && state.activeShift) {
              state.activeShift.sheetRow = res.rowNumber;
              state.activeShift.sheetTab = res.tabName || 'Attendance';
              localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(state.activeShift));
            }
          } else if (res && res.expired) {
            success = true; // Remove from queue so it does not loop
            if (currentUser && currentUser.subscription) {
              currentUser.subscription.isValid = false;
              if (typeof saveUserSession === 'function') saveUserSession(currentUser);
              showTrialExpiredModal();
            }
          } else {
            throw new Error((res && res.error) || 'Could not log shift to central directory');
          }
        }

        if (success) {
          const currentQ = getQueue();
          const updatedQ = currentQ.filter(q => q.id !== item.id);
          saveQueue(updatedQ);

          if (updatedQ.length === 0) {
            updateSyncBadge('synced', '✓ Synced with Google Sheet');
          } else {
            isProcessing = false;
            scheduleQueueFlush(Math.floor(Math.random() * 800 + 400));
            return;
          }
        }
      } catch (err) {
        console.warn('[Queue] Punch delivery exception:', err);
        item.attempts = (item.attempts || 0) + 1;
        const backoff = Math.min(30000, Math.pow(2, item.attempts) * 1500);
        const jitter = Math.floor(Math.random() * 1500);
        item.nextAttemptAt = Date.now() + backoff + jitter;

        const currentQ = getQueue();
        const idx = currentQ.findIndex(q => q.id === item.id);
        if (idx !== -1) {
          currentQ[idx] = item;
          saveQueue(currentQ);
        }

        updateSyncBadge('queued', `⚡ Saved Offline (Retrying in ${Math.round((backoff + jitter) / 1000)}s)`);
        scheduleQueueFlush(backoff + jitter);
      } finally {
        isProcessing = false;
      }
    }

    return {
      enqueuePunch,
      processQueue,
      getQueue,
      updateSyncBadge
    };
  })();

  // Listen for online events to automatically process queued items
  window.addEventListener('online', () => {
    PunchQueueManager.processQueue();
  });

  // Exports
  exports.PunchQueueManager = PunchQueueManager;
  window.PunchQueueManager = PunchQueueManager;

})(window.SheetPunch);
