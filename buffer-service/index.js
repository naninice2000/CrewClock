/**
 * SheetPunch Decoupled Buffer & Micro-Batching Service
 * ====================================================
 * High-throughput, low-latency ingestion endpoint for shift punches.
 * Ingests punches in <10ms and micro-batches direct writes via Google Sheets API v4.
 * Includes a 6-Hour in-memory slow-changing subscription cache with real-time webhook invalidation.
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const TENANCY_SCRIPT_URL = process.env.TENANCY_SCRIPT_URL || '';
const CENTRAL_DIRECTORY_SHEET_ID = process.env.CENTRAL_DIRECTORY_SHEET_ID || '';
const FLUSH_INTERVAL_MS = parseInt(process.env.FLUSH_INTERVAL_MS || '3000', 10);
const MAX_BATCH_SIZE = parseInt(process.env.MAX_BATCH_SIZE || '100', 10);
const CACHE_TTL_HOURS = parseFloat(process.env.CACHE_TTL_HOURS || '6');
const CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000;

// --- IN-MEMORY DATA STORES ---
let punchBuffer = [];
let isFlushing = false;
let totalIngested = 0;
let totalFlushed = 0;
let totalRejections = 0;

// 6-Hour Tenant & Subscription Cache: tenantId -> { status, expiresAt, sheetId, name, timeZone }
let tenantMemoryCache = {};
let lastCacheSyncTime = 0;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ============================================================
// 1. GOOGLE SHEETS API (v4) CLIENT INITIALIZATION
// ============================================================
let sheetsClient = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  try {
    const { sheets } = require('@googleapis/sheets');
    const { GoogleAuth } = require('google-auth-library');

    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    sheetsClient = sheets({ version: 'v4', auth });
    console.log('[Auth] Google Sheets API v4 initialized with Service Account credentials.');
    return sheetsClient;
  } catch (err) {
    console.warn('[Auth] Google Cloud Service Account credentials not detected. Operating in hybrid/Apps-Script fallback mode:', err.message);
    return null;
  }
}

// Helper to extract Spreadsheet ID from string or URL
function extractSheetId(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  const match = str.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(str)) return str;
  return null;
}

// ============================================================
// 2. 6-HOUR SUBSCRIPTION CACHE ENGINE (SLOW-CHANGING DATA)
// ============================================================
async function refreshTenantSubscriptions() {
  console.log('[Subscription Cache] Syncing tenant subscriptions from Central Directory...');
  const sheets = await getSheetsClient();

  if (sheets && CENTRAL_DIRECTORY_SHEET_ID) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: CENTRAL_DIRECTORY_SHEET_ID,
        range: 'Tenants!A2:O'
      });

      const rows = response.data.values || [];
      const newCache = {};

      for (const row of rows) {
        const tId = (row[0] || '').trim();
        if (!tId) continue;

        const businessName = row[1] || 'Business';
        const sheetTarget = row[4] || '';
        const status = (row[7] || 'trial').toLowerCase();
        const trialEndsAt = row[8] ? new Date(row[8]).getTime() : 0;
        const subEndsAt = row[14] ? new Date(row[14]).getTime() : 0;
        const expiresAt = subEndsAt || trialEndsAt || (Date.now() + 14 * 86400000);

        newCache[tId] = {
          tenantId: tId,
          name: businessName,
          sheetId: extractSheetId(sheetTarget),
          status: status,
          expiresAt: expiresAt,
          timeZone: row[5] || 'America/Los_Angeles',
          updatedAt: Date.now()
        };
      }

      tenantMemoryCache = newCache;
      lastCacheSyncTime = Date.now();
      console.log(`[Subscription Cache] Refreshed ${Object.keys(newCache).length} tenant records. Valid for ${CACHE_TTL_HOURS} hours.`);
      return true;
    } catch (err) {
      console.error('[Subscription Cache] Direct Google Sheets read error:', err.message);
    }
  }

  // Fallback: If no direct Sheet ID or API client, sync from Tenancy Script
  if (TENANCY_SCRIPT_URL) {
    try {
      const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args)).catch(() => globalThis.fetch(...args));
      const res = await fetch(`${TENANCY_SCRIPT_URL}?action=health`, { method: 'GET' });
      if (res.ok) {
        lastCacheSyncTime = Date.now();
        console.log('[Subscription Cache] Verified Tenancy Script connectivity.');
        return true;
      }
    } catch (scriptErr) {
      console.warn('[Subscription Cache] Tenancy Script health check warning:', scriptErr.message);
    }
  }

  return false;
}

// Validation Helper: Checks in-memory timestamps in 0.001ms
function validateTenantSubscription(tenantId) {
  if (!tenantId) return { valid: false, error: 'Tenant ID required' };
  
  const tenant = tenantMemoryCache[tenantId];
  if (!tenant) {
    // If tenant not yet loaded in cache (e.g. cold start), allow punch under grace period
    return { valid: true, cached: false, warning: 'Tenant not in local cache; allowed under grace period' };
  }

  const now = Date.now();
  if (tenant.expiresAt && now > tenant.expiresAt) {
    return {
      valid: false,
      expired: true,
      error: `Subscription or 14-day free trial has expired for ${tenant.name || tenantId}. Administrator must renew.`
    };
  }

  return { valid: true, cached: true, tenant };
}

// Initialize Cache and set recurring 6-hour refresh
refreshTenantSubscriptions();
const cacheSyncTimer = setInterval(refreshTenantSubscriptions, CACHE_TTL_MS);

// ============================================================
// 3. HEALTH & METRICS ENDPOINT
// ============================================================
app.get('/health', (req, res) => {
  const nextSyncInSeconds = Math.max(0, Math.round((lastCacheSyncTime + CACHE_TTL_MS - Date.now()) / 1000));
  res.json({
    status: 'ok',
    service: 'sheetpunch-buffer-service',
    engine: sheetsClient ? 'direct_sheets_api_v4' : 'apps_script_proxy_fallback',
    bufferedPunches: punchBuffer.length,
    totalIngested: totalIngested,
    totalFlushed: totalFlushed,
    totalRejections: totalRejections,
    flushIntervalMs: FLUSH_INTERVAL_MS,
    cachedTenantsCount: Object.keys(tenantMemoryCache).length,
    cacheTtlHours: CACHE_TTL_HOURS,
    nextCacheSyncSeconds: nextSyncInSeconds,
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Diagnostic endpoint to inspect specific tenant in memory
app.get('/api/v1/tenants/status/:tenantId', (req, res) => {
  const { tenantId } = req.params;
  const tenant = tenantMemoryCache[tenantId];
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant not found in memory cache' });
  }
  const isExpired = tenant.expiresAt ? Date.now() > tenant.expiresAt : false;
  return res.json({
    success: true,
    tenantId: tenantId,
    name: tenant.name,
    status: tenant.status,
    expiresAtIso: tenant.expiresAt ? new Date(tenant.expiresAt).toISOString() : null,
    isExpired: isExpired,
    sheetIdConfigured: !!tenant.sheetId
  });
});

// ============================================================
// 4. EVENT-DRIVEN CACHE INVALIDATION (PAYMENTS & ONBOARDING)
// ============================================================

// Payment Webhook: Instantly unlocks paying merchant without waiting for 6-hour poll
app.post('/api/v1/payments/webhook', (req, res) => {
  const payload = req.body || {};
  const tenantId = payload.tenantId || payload.tenant_id;
  const durationDays = parseInt(payload.durationDays || '30', 10);
  const status = (payload.status || 'captured').toLowerCase();

  if (!tenantId) {
    return res.status(400).json({ success: false, error: 'tenantId is required' });
  }

  if (status === 'captured' || status === 'approved' || status === 'success') {
    const durationMs = durationDays * 24 * 60 * 60 * 1000;
    const currentExpiry = tenantMemoryCache[tenantId]?.expiresAt || Date.now();
    const newExpiry = Math.max(Date.now(), currentExpiry) + durationMs;

    tenantMemoryCache[tenantId] = {
      ...(tenantMemoryCache[tenantId] || {}),
      tenantId: tenantId,
      status: 'active',
      expiresAt: newExpiry,
      updatedAt: Date.now()
    };

    console.log(`[Payment Webhook] Instantly updated subscription for ${tenantId}. New expiry: ${new Date(newExpiry).toISOString()}`);
    return res.json({
      success: true,
      message: 'Tenant subscription renewed and cached in memory immediately.',
      tenantId: tenantId,
      expiresAt: new Date(newExpiry).toISOString()
    });
  }

  return res.json({ success: true, message: 'Webhook event received (non-capturing).' });
});

// Onboarding Register Hook: Adds new tenant immediately to cache
app.post('/api/v1/tenant/register', (req, res) => {
  const { tenantId, name, sheetId, timeZone, trialDays } = req.body;
  if (!tenantId) {
    return res.status(400).json({ success: false, error: 'tenantId is required' });
  }

  const days = trialDays || 14;
  const trialEndsAt = Date.now() + days * 24 * 60 * 60 * 1000;

  tenantMemoryCache[tenantId] = {
    tenantId: tenantId,
    name: name || 'Business',
    sheetId: extractSheetId(sheetId),
    status: 'trial',
    expiresAt: trialEndsAt,
    timeZone: timeZone || 'America/Los_Angeles',
    updatedAt: Date.now()
  };

  console.log(`[Onboard Hook] Registered new tenant ${tenantId} in memory with 14-day trial.`);
  return res.json({
    success: true,
    tenantId: tenantId,
    expiresAt: new Date(trialEndsAt).toISOString()
  });
});

// ============================================================
// 5. HIGH-THROUGHPUT PUNCH INGESTION ENDPOINT (<10ms)
// ============================================================
app.post('/api/v1/punch', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.email || !payload.tenantId) {
    return res.status(400).json({
      success: false,
      error: 'Invalid punch payload: email and tenantId are required'
    });
  }

  const tenantId = payload.tenantId.trim();

  // Instant In-Memory Subscription Validation (0.001ms)
  const validation = validateTenantSubscription(tenantId);
  if (!validation.valid) {
    totalRejections++;
    return res.status(403).json({
      success: false,
      expired: true,
      error: validation.error
    });
  }

  const resolvedSheetId = extractSheetId(payload.sheetId) || tenantMemoryCache[tenantId]?.sheetId || null;

  const punchItem = {
    id: payload.punchId || payload.id || `buf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    subAction: (payload.type || payload.subAction || 'clockin').toLowerCase(),
    email: payload.email.trim().toLowerCase(),
    tenantId: tenantId,
    sheetId: resolvedSheetId,
    name: payload.name || 'Staff Member',
    latitude: payload.latitude || '',
    longitude: payload.longitude || '',
    accuracy: payload.accuracy || '',
    timestamp: payload.timestamp || new Date().toLocaleString(),
    clockInIso: payload.clockInIso || '',
    clockOutIso: payload.clockOutIso || '',
    sheetRow: payload.sheetRow || '',
    duration: payload.duration || '',
    receivedAt: Date.now(),
    attempts: 0
  };

  punchBuffer.push(punchItem);
  totalIngested++;

  // Return immediate 202 Accepted (<10ms)
  return res.status(202).json({
    success: true,
    status: 'buffered',
    punchId: punchItem.id,
    queueDepth: punchBuffer.length
  });
});

// Batch punch ingestion
app.post('/api/v1/batch-punches', (req, res) => {
  const { punches } = req.body;
  if (!Array.isArray(punches) || punches.length === 0) {
    return res.status(400).json({ success: false, error: 'punches array is required' });
  }

  let acceptedCount = 0;
  for (const p of punches) {
    if (p && p.email && p.tenantId) {
      const tId = p.tenantId.trim();
      const val = validateTenantSubscription(tId);
      if (!val.valid) {
        totalRejections++;
        continue;
      }

      const sId = extractSheetId(p.sheetId) || tenantMemoryCache[tId]?.sheetId || null;
      punchBuffer.push({
        id: p.punchId || p.id || `buf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        subAction: (p.type || p.subAction || 'clockin').toLowerCase(),
        email: p.email.trim().toLowerCase(),
        tenantId: tId,
        sheetId: sId,
        name: p.name || 'Staff Member',
        latitude: p.latitude || '',
        longitude: p.longitude || '',
        accuracy: p.accuracy || '',
        timestamp: p.timestamp || new Date().toLocaleString(),
        clockInIso: p.clockInIso || '',
        clockOutIso: p.clockOutIso || '',
        sheetRow: p.sheetRow || '',
        duration: p.duration || '',
        receivedAt: Date.now(),
        attempts: 0
      });
      acceptedCount++;
    }
  }

  totalIngested += acceptedCount;
  return res.status(202).json({
    success: true,
    status: 'buffered',
    ingestedCount: acceptedCount,
    queueDepth: punchBuffer.length
  });
});

// ============================================================
// 6. MICRO-BATCH FLUSH ENGINE (DIRECT SHEETS API v4)
// ============================================================
async function flushBuffer() {
  if (isFlushing || punchBuffer.length === 0) return;
  isFlushing = true;

  const batch = punchBuffer.splice(0, MAX_BATCH_SIZE);
  console.log(`[Buffer Flush] Processing batch of ${batch.length} punches...`);

  const sheets = await getSheetsClient();

  if (sheets) {
    // --- ROUTE A: DIRECT GOOGLE SHEETS API v4 (ZERO APPS SCRIPT) ---
    try {
      // Group punches by sheetId
      const groupsBySheet = {};
      const unassigned = [];

      for (const item of batch) {
        const sId = item.sheetId || tenantMemoryCache[item.tenantId]?.sheetId;
        if (sId) {
          if (!groupsBySheet[sId]) groupsBySheet[sId] = [];
          groupsBySheet[sId].push(item);
        } else {
          unassigned.push(item);
        }
      }

      // Process each merchant spreadsheet
      const sheetPromises = Object.entries(groupsBySheet).map(async ([sId, items]) => {
        const clockIns = items.filter(p => p.subAction === 'clockin');
        const clockOuts = items.filter(p => p.subAction === 'clockout');

        // 1. Multi-Row Clock-In Append (1 call per merchant sheet)
        if (clockIns.length > 0) {
          const appendRows = clockIns.map(p => {
            const coords = (p.latitude && p.longitude) ? `${p.latitude}, ${p.longitude}` : '';
            const mapUrl = coords ? `https://www.google.com/maps?q=${coords}` : '';
            const dateStr = p.timestamp ? p.timestamp.split(' ')[0] : new Date().toLocaleDateString();
            return [
              dateStr,
              p.name,
              p.email,
              p.timestamp,
              coords,
              mapUrl,
              '', // Clock Out Time
              '', // Total Duration
              '', // Out Coords
              '', // Out Map
              'Clocked In'
            ];
          });

          await sheets.spreadsheets.values.append({
            spreadsheetId: sId,
            range: 'Attendance!A:K',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: appendRows }
          });
        }

        // 2. Multi-Range Clock-Out Batch Update (1 batchUpdate call per merchant sheet)
        if (clockOuts.length > 0) {
          const updateRanges = [];
          for (const p of clockOuts) {
            const row = parseInt(p.sheetRow, 10);
            if (row && row >= 2) {
              const coords = (p.latitude && p.longitude) ? `${p.latitude}, ${p.longitude}` : '';
              const mapUrl = coords ? `https://www.google.com/maps?q=${coords}` : '';
              updateRanges.push({
                range: `Attendance!G${row}:K${row}`,
                values: [[
                  p.timestamp,
                  p.duration || '0m',
                  coords,
                  mapUrl,
                  'Completed'
                ]]
              });
            }
          }

          if (updateRanges.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
              spreadsheetId: sId,
              requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updateRanges
              }
            });
          }
        }
      });

      await Promise.all(sheetPromises);
      totalFlushed += (batch.length - unassigned.length);
      console.log(`[Buffer Flush] Direct API: Flushed ${batch.length - unassigned.length} punches across ${Object.keys(groupsBySheet).length} sheets.`);

      // Re-queue any items lacking a sheetId
      for (const u of unassigned) {
        u.attempts = (u.attempts || 0) + 1;
        if (u.attempts <= 5) punchBuffer.unshift(u);
      }

      isFlushing = false;
      return;
    } catch (apiErr) {
      console.error('[Buffer Flush] Direct Google Sheets API error, falling back to Apps Script proxy:', apiErr.message);
    }
  }

  // --- ROUTE B: APPS SCRIPT PROXY FALLBACK ---
  if (TENANCY_SCRIPT_URL) {
    try {
      const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args)).catch(() => globalThis.fetch(...args));
      const response = await fetch(TENANCY_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_log_shifts',
          shifts: batch
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.success) {
          totalFlushed += batch.length;
          console.log(`[Buffer Flush] Apps Script Fallback: Successfully flushed ${batch.length} punches.`);
          isFlushing = false;
          return;
        }
      }
    } catch (proxyErr) {
      console.error('[Buffer Flush] Apps Script Fallback error:', proxyErr.message);
    }
  }

  // Dead-Letter / Retry Handling on failure
  for (const item of batch) {
    item.attempts = (item.attempts || 0) + 1;
    if (item.attempts <= 5) {
      punchBuffer.unshift(item);
    } else {
      console.error(`[Buffer Flush] Dropping punch ${item.id} after 5 failed retry attempts.`);
    }
  }

  isFlushing = false;
}

// Flush timer (every 3 seconds)
const flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL_MS);

// Graceful Termination
const shutdown = async () => {
  console.log('[Buffer Worker] Shutting down, flushing remaining queue...');
  clearInterval(flushTimer);
  clearInterval(cacheSyncTimer);
  await flushBuffer();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SheetPunch Decoupled Buffer Service running on port ${PORT}`);
    console.log(`Direct API Mode: ${CENTRAL_DIRECTORY_SHEET_ID ? 'Enabled' : 'Pending Sheet ID'}`);
    console.log(`Flush Interval: ${FLUSH_INTERVAL_MS}ms | Cache TTL: ${CACHE_TTL_HOURS}h`);
  });
}

module.exports = {
  app,
  punchBuffer,
  tenantMemoryCache,
  validateTenantSubscription,
  refreshTenantSubscriptions,
  flushBuffer
};
