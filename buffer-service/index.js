/**
 * SheetPunch Decoupled Buffer & Micro-Batching Service
 * ====================================================
 * High-throughput, low-latency ingestion endpoint for shift punches.
 * Ingests punches in <10ms and micro-batches writes to Google Apps Script / Sheets API.
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const TENANCY_SCRIPT_URL = process.env.TENANCY_SCRIPT_URL || '';
const FLUSH_INTERVAL_MS = parseInt(process.env.FLUSH_INTERVAL_MS || '5000', 10);
const MAX_BATCH_SIZE = parseInt(process.env.MAX_BATCH_SIZE || '100', 10);

// In-Memory Ring Buffer for high throughput
let punchBuffer = [];
let isFlushing = false;
let totalIngested = 0;
let totalFlushed = 0;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 1. Health & Metrics Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'sheetpunch-buffer-service',
    bufferedPunches: punchBuffer.length,
    totalIngested: totalIngested,
    totalFlushed: totalFlushed,
    flushIntervalMs: FLUSH_INTERVAL_MS,
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// 2. High-Throughput Ingestion Endpoint (<10ms response)
app.post('/api/v1/punch', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.email || !payload.tenantId) {
    return res.status(400).json({
      success: false,
      error: 'Invalid punch payload: email and tenantId are required'
    });
  }

  const punchItem = {
    id: payload.punchId || payload.id || `buf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    subAction: (payload.type || payload.subAction || 'clockin').toLowerCase(),
    email: payload.email.trim().toLowerCase(),
    tenantId: payload.tenantId.trim(),
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

  // Immediate 202 Accepted response ensures 0ms worker blocking
  return res.status(202).json({
    success: true,
    status: 'buffered',
    punchId: punchItem.id,
    queueDepth: punchBuffer.length
  });
});

// 3. Batch Ingestion Endpoint
app.post('/api/v1/batch-punches', (req, res) => {
  const { punches } = req.body;
  if (!Array.isArray(punches) || punches.length === 0) {
    return res.status(400).json({ success: false, error: 'punches array is required' });
  }

  let count = 0;
  for (const p of punches) {
    if (p && p.email && p.tenantId) {
      punchBuffer.push({
        id: p.punchId || p.id || `buf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        subAction: (p.type || p.subAction || 'clockin').toLowerCase(),
        email: p.email.trim().toLowerCase(),
        tenantId: p.tenantId.trim(),
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
      count++;
    }
  }

  totalIngested += count;
  return res.status(202).json({
    success: true,
    status: 'buffered',
    ingestedCount: count,
    queueDepth: punchBuffer.length
  });
});

// 4. Background Flush Engine (Batched writes to Google Apps Script)
async function flushBuffer() {
  if (isFlushing || punchBuffer.length === 0) return;
  if (!TENANCY_SCRIPT_URL) {
    console.warn('[Buffer Worker] TENANCY_SCRIPT_URL not configured. Punches remain buffered.');
    return;
  }

  isFlushing = true;
  const batch = punchBuffer.splice(0, MAX_BATCH_SIZE);
  console.log(`[Buffer Worker] Flushing batch of ${batch.length} punches to Tenancy Script...`);

  try {
    const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args)).catch(() => globalThis.fetch(...args));
    
    // Dispatch to Apps Script batch_log_shifts endpoint
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
        console.log(`[Buffer Worker] Successfully flushed ${batch.length} punches to merchant sheets.`);
      } else {
        throw new Error((data && data.error) || 'Apps Script reported failure');
      }
    } else {
      throw new Error(`Apps Script responded with status ${response.status}`);
    }
  } catch (err) {
    console.error('[Buffer Worker] Flush error:', err.message);
    // Re-queue failed batch items that haven't exceeded retry limits
    for (const item of batch) {
      item.attempts = (item.attempts || 0) + 1;
      if (item.attempts <= 5) {
        punchBuffer.unshift(item);
      } else {
        console.error(`[Buffer Worker] Dropping dead punch ${item.id} after 5 failed attempts.`);
      }
    }
  } finally {
    isFlushing = false;
  }
}

// Recurring flush interval
const flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL_MS);

// Graceful termination
const shutdown = async () => {
  console.log('[Buffer Worker] Shutting down, flushing remaining buffer...');
  clearInterval(flushTimer);
  await flushBuffer();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SheetPunch Decoupled Buffer Service running on port ${PORT}`);
    console.log(`Flush interval: ${FLUSH_INTERVAL_MS}ms | Max batch: ${MAX_BATCH_SIZE}`);
  });
}

module.exports = { app, punchBuffer, flushBuffer };
