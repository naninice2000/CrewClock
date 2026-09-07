# SheetPunch Decoupled Buffer & Micro-Batching Service

This microservice implements the **Decoupled Buffer / Queue** SaaS architecture for SheetPunch.

```
[Mobile App / Web App]
        │
        ▼ (Instant HTTP POST /api/v1/punch in <10ms)
[Buffer Microservice (Cloud Function / Cloud Run)]
        │
        ▼ (In-memory / Cloud Tasks Buffer — Groups by Merchant Sheet)
[Micro-Batch Writer Engine (Every 5–10 seconds)]
        │
        ▼ (1 Batched Call per Company via action: batch_log_shifts)
[Customer Google Sheets / Central Apps Script]
```

---

## Capabilities

1. **<10ms Response Time (`202 Accepted`):**
   Employees' phones are never blocked by Google Sheets API latency. The punch is accepted into memory immediately.
2. **Micro-Batching (90% Quota Reduction):**
   If 20 workers punch in at 8:00 AM at the same business, this service collects those 20 punches and flushes them in **one single batch call** to `batch_log_shifts`, consuming 1 Google API write instead of 20.
3. **Automatic Dead-Letter Retries:**
   Any failed writes are retried up to 5 times before alerting.

---

## Quick Start (Local Development)

```bash
cd buffer-service
npm install
node index.js
```

The service will start on port `8080`.

Test health check:
```bash
curl http://localhost:8080/health
```

Test punch ingestion:
```bash
curl -X POST http://localhost:8080/api/v1/punch \
  -H "Content-Type: application/json" \
  -d '{
    "type": "clockin",
    "email": "employee@example.com",
    "tenantId": "TENANT_123",
    "name": "Sarah Connor",
    "latitude": "37.7749",
    "longitude": "-122.4194",
    "accuracy": "10",
    "timestamp": "Sep 06, 2026 08:00:00 AM"
  }'
```

---

## Deployment Options

### Option A: Firebase Cloud Functions (100% Free Tier)

1. Initialize Firebase Functions in this directory:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init functions
   ```
2. Export the Express app in `functions/index.js`:
   ```javascript
   const functions = require('firebase-functions');
   const { app } = require('./buffer-service/index');
   exports.api = functions.https.onRequest(app);
   ```
3. Deploy:
   ```bash
   firebase deploy --only functions
   ```
4. Copy the resulting URL into `config.js`:
   ```javascript
   bufferEndpointUrl: "https://us-central1-YOUR_PROJECT.cloudfunctions.net/api"
   ```

### Option B: Google Cloud Run (Containerized)

1. Build & Deploy directly from source:
   ```bash
   gcloud run deploy sheetpunch-buffer \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars TENANCY_SCRIPT_URL="https://script.google.com/macros/s/.../exec"
   ```
2. Copy the Cloud Run service URL into `config.js`.

---

## Client Fallback Guarantee

If `bufferEndpointUrl` is empty or the microservice is unreachable, the SheetPunch client app (`app.js`) automatically falls back to:
1. Direct customer Apps Script webhook (Choice B), OR
2. Central Tenancy Script `log_shift` (Choice A).
