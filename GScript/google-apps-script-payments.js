/**
 * Google Apps Script for SheetPunch Dedicated Payments & Billing Engine
 * ---------------------------------------------------------------------
 * Integration: Q PaymentZ Payments API v1
 * Environments: Sandbox (finstage.qpaymentz.com) & Production (fintech.qpaymentz.com)
 *
 * INSTRUCTIONS:
 * 1. Open Google Sheets and create a NEW spreadsheet (https://sheets.new).
 *    Name it: "SheetPunch - Payments & Billing Ledger"
 * 2. In the top menu, click Extensions > Apps Script.
 * 3. Delete any boilerplate code and paste this entire script.
 * 4. Configure your Gateway Credentials & Environment in Script Properties:
 *    - Click Project Settings (gear icon in the left sidebar) > Script Properties > Add script property:
 *      * QPZ_ENVIRONMENT   : "sandbox" (or "production" when going live)
 *      * QPZ_CLIENT_ID     : "<Your Q PaymentZ Client ID>"
 *      * QPZ_CLIENT_SECRET : "<Your Q PaymentZ Client Secret>"
 *      * QPZ_WEBHOOK_SECRET: "<Your Webhook Signing Secret (Optional)>"
 *      * TENANCY_SCRIPT_URL: "<Your SheetPunch Tenancy Web App URL (Optional, to auto-sync subscriptions)>"
 * 5. Click "Deploy" (top right blue button) > "New deployment".
 * 6. Select type: "Web app"
 *    - Description: "SheetPunch Dedicated Payments Gateway"
 *    - Execute as: "Me (your email)"
 *    - Who has access: "Anyone"
 * 7. Click "Deploy", authorize access, and copy the Web app URL.
 * 8. Paste this URL into `APP_CONFIG.paymentsScriptUrl` in config.js (or in app Settings).
 */

// ============================================================
// CONFIGURATION & CONSTANTS
// ============================================================

var GATEWAY_CONFIG = {
  version: "1.0.0",
  // Default environment fallback if not set in Script Properties: 'sandbox' or 'production'
  defaultEnvironment: "sandbox",
  environments: {
    sandbox: {
      name: "Sandbox (Testing)",
      baseUrl: "https://finstage.qpaymentz.com/payments-api/v1"
    },
    production: {
      name: "Production (Live)",
      baseUrl: "https://fintech.qpaymentz.com/payments-api/v1"
    }
  }
};

// Canonical Pricing Catalog (Source of Truth - amounts in USD Cents)
var PRICING_CATALOG = {
  starter: {
    name: "Starter Crew",
    teamSize: "Up to 15 Employees",
    monthly: {
      cents: 999,
      formatted: "$9.99",
      durationDays: 30
    },
    yearly: {
      cents: 9900,
      formatted: "$99.00",
      durationDays: 365
    }
  },
  growth: {
    name: "Growth Crew",
    teamSize: "16 – 35 Employees",
    monthly: {
      cents: 1999,
      formatted: "$19.99",
      durationDays: 30
    },
    yearly: {
      cents: 19900,
      formatted: "$199.00",
      durationDays: 365
    }
  },
  scale: {
    name: "Pro Crew",
    teamSize: "36 – 50 Employees",
    monthly: {
      cents: 2499,
      formatted: "$24.99",
      durationDays: 30
    },
    yearly: {
      cents: 24900,
      formatted: "$249.00",
      durationDays: 365
    }
  }
};
PRICING_CATALOG.pro = PRICING_CATALOG.scale; // Alias for Pro Crew

// ============================================================
// HTTP DISPATCHERS (doPost & doGet)
// ============================================================

function doPost(e) {
  return handlePaymentRequest(e);
}

function doGet(e) {
  return handlePaymentRequest(e);
}

function handlePaymentRequest(e) {
  try {
    e = e || {};
    var data = parseRequestData(e);
    var action = (data.action || "").toLowerCase();
    var headers = (e && e.headers) ? e.headers : {};

    // 1. Health & Configuration Check
    if (!action || action === "health") {
      return handleHealthCheck();
    }

    // 2. Query Pricing Catalog
    if (action === "get_pricing") {
      return responseJSON({
        success: true,
        catalog: PRICING_CATALOG,
        environment: getActiveEnvironment().name
      });
    }

    // 3. Process Sale (One-Time Authorization & Capture)
    if (action === "create_sale" || action === "charge") {
      return handleCreateSale(data);
    }

    // 4. Webhook Notification Listener
    if (action === "webhook" || headers["X-QPZ-Signature"] || headers["x-qpz-signature"]) {
      return handleWebhookNotification(e, data);
    }

    return responseJSON({
      success: false,
      error: "Unknown action: " + action + ". Supported actions: health, get_pricing, create_sale, webhook"
    });

  } catch (err) {
    return responseJSON({
      success: false,
      error: "Unexpected Payment Server Error: " + (err.message || String(err))
    });
  }
}

// ============================================================
// CORE PAYMENT LOGIC: CREATE SALE
// ============================================================

/**
 * Executes a sale transaction via Q PaymentZ Payments API v1.
 * Flow:
 *  1. Resolve server-side plan & price (cents)
 *  2. Get OAuth Bearer Token from Q PaymentZ
 *  3. Tokenize card (or use provider_token from client-side hosted fields)
 *  4. Call POST /transactions/sale with Idempotency-Key
 *  5. Log transaction to "Payments" ledger sheet
 *  6. Optionally notify Tenancy Directory script to activate subscription
 */
function handleCreateSale(data) {
  var adminEmail = (data.adminEmail || "").trim().toLowerCase();
  var tenantId = (data.tenantId || "").trim();
  var planKey = (data.planKey || data.plan || "starter").trim().toLowerCase();
  var billingCycle = (data.billingCycle || "monthly").trim().toLowerCase();
  var platform = (data.platform || "web").toLowerCase();

  if (!adminEmail || !tenantId) {
    return responseJSON({
      success: false,
      error: "Missing required parameters: adminEmail and tenantId are required."
    });
  }

  // 1. Resolve Pricing Server-Side (Tamper-Proof)
  var planRate = resolvePlanPricing(planKey, billingCycle);
  if (!planRate) {
    return responseJSON({
      success: false,
      error: "Invalid plan or billing cycle. Valid plans: starter, growth, scale, pro. Cycles: monthly, yearly."
    });
  }

  // 2. Resolve Environment & Gateway Credentials
  var env = getActiveEnvironment();
  var credentials = getGatewayCredentials();
  if (!credentials.clientId || !credentials.clientSecret) {
    return responseJSON({
      success: false,
      error: "Q PaymentZ API credentials not configured in Script Properties. Please set QPZ_CLIENT_ID and QPZ_CLIENT_SECRET."
    });
  }

  // 3. Get OAuth 2.0 Bearer Access Token
  var accessTokenResult = getQpzAccessToken(env, credentials);
  if (!accessTokenResult.success) {
    return responseJSON({
      success: false,
      error: "Gateway Authentication Failed: " + accessTokenResult.error
    });
  }
  var bearerToken = accessTokenResult.accessToken;

  // 4. Tokenize Card (or accept pre-minted provider_token)
  var tokenResult = tokenizeCard(env, bearerToken, data);
  if (!tokenResult.success) {
    return responseJSON({
      success: false,
      error: "Card Tokenization Failed: " + tokenResult.error
    });
  }
  var qpzToken = tokenResult.token;
  var paymentMethod = tokenResult.paymentMethod || {};

  // 5. Run the Sale (/transactions/sale)
  var idempotencyKey = data.idempotencyKey || Utilities.getUuid();
  var orderRef = "SHEETPUNCH-" + tenantId + "-" + Date.now();

  var salePayload = {
    amount: {
      value: planRate.cents,
      currency: "USD"
    },
    payment: {
      type: "token",
      token: qpzToken
    },
    order: {
      reference: orderRef
    },
    metadata: {
      tenant_id: tenantId,
      admin_email: adminEmail,
      plan_name: planRate.planName,
      plan_key: planRate.planKey,
      billing_cycle: billingCycle,
      platform: platform,
      environment: env.key
    }
  };

  var saleUrl = env.baseUrl + "/transactions/sale";
  var saleOptions = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + bearerToken,
      "Idempotency-Key": idempotencyKey
    },
    payload: JSON.stringify(salePayload),
    muteHttpExceptions: true
  };

  var response;
  try {
    response = UrlFetchApp.fetch(saleUrl, saleOptions);
  } catch (netErr) {
    return responseJSON({
      success: false,
      error: "Network error connecting to Q PaymentZ Gateway: " + netErr.message
    });
  }

  var responseCode = response.getResponseCode();
  var responseText = response.getContentText();
  var saleData = {};
  try {
    saleData = JSON.parse(responseText);
  } catch (e) {
    saleData = { raw: responseText };
  }

  // Handle Response Codes
  // Q PaymentZ returns HTTP 201 for completed transactions (approved OR declined)
  if (responseCode === 201) {
    if (saleData.approved === true) {
      // Transaction Approved & Captured!
      var txnId = saleData.id || ("txn_" + Utilities.getUuid().slice(0, 10));
      var authCode = saleData.auth_code || "";
      var cardBrand = (saleData.payment_method && saleData.payment_method.brand) || paymentMethod.brand || "Card";
      var cardLast4 = (saleData.payment_method && saleData.payment_method.last4) || paymentMethod.last4 || "••••";

      // 6. Record to "Payments" Sheet Ledger
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var ledgerSheet = getOrCreatePaymentsSheet(ss);
      var nowIso = new Date().toISOString();

      ledgerSheet.appendRow([
        txnId,
        nowIso,
        tenantId,
        adminEmail,
        planRate.planName,
        planRate.planKey,
        billingCycle,
        planRate.formattedPrice,
        planRate.cents,
        "captured",
        cardBrand,
        cardLast4,
        authCode,
        env.key,
        idempotencyKey
      ]);

      // 7. Sync with Tenancy Directory (Auto-activate Tenant Subscription)
      var syncResult = syncWithTenancyDirectory({
        adminEmail: adminEmail,
        tenantId: tenantId,
        plan: planRate.planName,
        billingCycle: billingCycle,
        paidAmount: planRate.formattedPrice,
        paymentRef: txnId,
        durationDays: planRate.durationDays,
        platform: platform
      });

      return responseJSON({
        success: true,
        approved: true,
        message: "Payment processed successfully! Subscription is now active.",
        transaction: {
          id: txnId,
          status: "captured",
          code: "approved",
          authCode: authCode,
          amount: planRate.formattedPrice,
          amountCents: planRate.cents,
          currency: "USD",
          planName: planRate.planName,
          billingCycle: billingCycle,
          durationDays: planRate.durationDays,
          cardBrand: cardBrand,
          last4: cardLast4,
          createdAt: nowIso,
          environment: env.key
        },
        tenancySync: syncResult
      });

    } else {
      // Declined by Card Issuer / Processor
      return responseJSON({
        success: false,
        approved: false,
        code: saleData.code || "declined",
        error: getDeclineUserMessage(saleData.code)
      });
    }
  }

  // Handle HTTP Client/Server Errors (4xx / 5xx)
  var errorMsg = (saleData.error && saleData.error.message) || ("Gateway error (HTTP " + responseCode + ")");
  return responseJSON({
    success: false,
    error: errorMsg,
    code: (saleData.error && saleData.error.code) || "http_" + responseCode
  });
}

// ============================================================
// OAUTH 2.0 TOKEN MANAGEMENT (With ScriptCache)
// ============================================================

/**
 * Exchanges client_id and client_secret for a 15-minute Bearer access token.
 * Caches the token in CacheService to minimize round trips.
 */
function getQpzAccessToken(env, credentials) {
  var cacheKey = "qpz_token_" + env.key;
  var cache = CacheService.getScriptCache();
  var cachedToken = cache.get(cacheKey);

  if (cachedToken) {
    return { success: true, accessToken: cachedToken, cached: true };
  }

  var tokenUrl = env.baseUrl + "/oauth/token";
  var basicAuth = Utilities.base64Encode(credentials.clientId + ":" + credentials.clientSecret);

  var options = {
    method: "post",
    headers: {
      "Authorization": "Basic " + basicAuth,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({
      grant_type: "client_credentials"
    }),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(tokenUrl, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();
    var tokenData = JSON.parse(responseText);

    if (statusCode === 200 && tokenData.access_token) {
      // Cache token for (expires_in - 60) seconds (Q PaymentZ tokens last 900s)
      var ttl = Math.max(60, (tokenData.expires_in || 900) - 60);
      cache.put(cacheKey, tokenData.access_token, ttl);

      return {
        success: true,
        accessToken: tokenData.access_token,
        cached: false
      };
    } else {
      var errDetail = (tokenData.error && tokenData.error.message) || responseText;
      return {
        success: false,
        error: "OAuth token request failed (" + statusCode + "): " + errDetail
      };
    }
  } catch (err) {
    return {
      success: false,
      error: "Error requesting OAuth token: " + err.message
    };
  }
}

// ============================================================
// TOKENIZE CARD (POST /tokens)
// ============================================================

/**
 * Converts card details or a client-side provider token into a single-use Q PaymentZ token.
 */
function tokenizeCard(env, bearerToken, data) {
  var tokenUrl = env.baseUrl + "/tokens";
  var tokenPayload = {};

  if (data.provider_token || data.providerToken) {
    // Minted by client-side hosted fields (SAQ-A scope)
    tokenPayload.provider_token = data.provider_token || data.providerToken;
  } else if (data.card) {
    // Raw card payload (Sanbox testing)
    var card = data.card;
    tokenPayload.card = {
      number: String(card.number || "").replace(/\s+/g, ""),
      exp_month: parseInt(card.exp_month || card.expMonth || "1", 10),
      exp_year: parseInt(card.exp_year || card.expYear || "2030", 10),
      cvc: String(card.cvc || card.cvv || ""),
      postal_code: String(card.postal_code || card.postalCode || card.zip || "")
    };
    if (card.name) tokenPayload.card.name = card.name;
  } else {
    return {
      success: false,
      error: "No card information or provider_token provided."
    };
  }

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + bearerToken
    },
    payload: JSON.stringify(tokenPayload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(tokenUrl, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();
    var resultData = JSON.parse(responseText);

    if (statusCode === 201 && resultData.token) {
      return {
        success: true,
        token: resultData.token,
        paymentMethod: resultData.payment_method || {}
      };
    } else {
      var msg = (resultData.error && resultData.error.message) || responseText;
      return {
        success: false,
        error: "Tokenization rejected (" + statusCode + "): " + msg
      };
    }
  } catch (err) {
    return {
      success: false,
      error: "Tokenization request error: " + err.message
    };
  }
}

// ============================================================
// TENANCY DIRECTORY SYNC
// ============================================================

/**
 * Notifies the Tenant Directory Google Apps Script to immediately activate the tenant's subscription.
 */
function syncWithTenancyDirectory(paymentDetails) {
  var props = PropertiesService.getScriptProperties();
  var tenancyUrl = props.getProperty("TENANCY_SCRIPT_URL") || "";

  if (!tenancyUrl) {
    return {
      synced: false,
      message: "TENANCY_SCRIPT_URL not configured. Client must invoke record_payment directly."
    };
  }

  try {
    var payload = {
      action: "record_payment",
      adminEmail: paymentDetails.adminEmail,
      tenantId: paymentDetails.tenantId,
      plan: paymentDetails.plan,
      billingCycle: paymentDetails.billingCycle,
      paidAmount: paymentDetails.paidAmount,
      paymentRef: paymentDetails.paymentRef,
      durationDays: paymentDetails.durationDays,
      platform: paymentDetails.platform
    };

    var response = UrlFetchApp.fetch(tenancyUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var resText = response.getContentText();
    var resData = JSON.parse(resText);
    return {
      synced: resData.success === true,
      data: resData
    };
  } catch (e) {
    return {
      synced: false,
      error: "Failed to notify Tenancy Directory: " + e.message
    };
  }
}

// ============================================================
// WEBHOOK LISTENER (HMAC-SHA256 SIGNATURE VERIFICATION)
// ============================================================

/**
 * Handles incoming webhooks from Q PaymentZ (e.g. transaction.captured, transaction.settled).
 */
function handleWebhookNotification(e, data) {
  var props = PropertiesService.getScriptProperties();
  var webhookSecret = props.getProperty("QPZ_WEBHOOK_SECRET") || "";

  var headers = e.headers || {};
  var sigHeader = headers["X-QPZ-Signature"] || headers["x-qpz-signature"] || "";

  // Verify Signature if webhook secret is configured
  if (webhookSecret && sigHeader) {
    var isValid = verifyWebhookSignature(sigHeader, e.postData.contents, webhookSecret);
    if (!isValid) {
      return responseJSON({ success: false, error: "Invalid webhook signature" }, 401);
    }
  }

  var event = data.event || "unknown";
  var eventData = data.data || {};
  var txnId = eventData.id || "";

  // Append event log to "Webhook_Events" sheet for auditing
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hookSheet = getOrCreateSheet(ss, "Webhook_Events", [
      "Timestamp",
      "Event",
      "Transaction ID",
      "Status",
      "Amount",
      "Order Ref",
      "Raw Data"
    ]);

    hookSheet.appendRow([
      new Date().toISOString(),
      event,
      txnId,
      eventData.status || "",
      (eventData.amount && eventData.amount.value) || "",
      eventData.order_ref || "",
      JSON.stringify(eventData)
    ]);
  } catch (logErr) {}

  return responseJSON({ success: true, received: true, event: event });
}

/**
 * Recomputes HMAC-SHA256 signature according to Q PaymentZ spec:
 * Header format: t=1788191466, v1=HMAC_SHA256(secret, t + "." + rawBody)
 */
function verifyWebhookSignature(sigHeader, rawBody, secret) {
  try {
    var parts = sigHeader.split(",").reduce(function(acc, part) {
      var kv = part.trim().split("=");
      if (kv.length === 2) acc[kv[0]] = kv[1];
      return acc;
    }, {});

    var timestamp = parts["t"];
    var expectedV1 = parts["v1"];
    if (!timestamp || !expectedV1) return false;

    // Check for replay attacks (> 5 minutes old)
    var nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - parseInt(timestamp, 10)) > 300) {
      return false;
    }

    var signedPayload = timestamp + "." + rawBody;
    var signatureBytes = Utilities.computeHmacSha256Signature(signedPayload, secret);
    var computedHex = signatureBytes.map(function(b) {
      var hex = (b < 0 ? b + 256 : b).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");

    return computedHex === expectedV1;
  } catch (err) {
    return false;
  }
}

// ============================================================
// HEALTH CHECK & DIAGNOSTICS
// ============================================================

function handleHealthCheck() {
  var env = getActiveEnvironment();
  var credentials = getGatewayCredentials();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var paymentsSheet = ss.getSheetByName("Payments");
  var totalPayments = paymentsSheet ? Math.max(0, paymentsSheet.getLastRow() - 1) : 0;

  var serviceEmail = "";
  try {
    serviceEmail = Session.getEffectiveUser().getEmail();
  } catch (e) {}

  return responseJSON({
    success: true,
    service: "SheetPunch Dedicated Payments Gateway",
    version: GATEWAY_CONFIG.version,
    serviceEmail: serviceEmail,
    environment: {
      key: env.key,
      name: env.name,
      baseUrl: env.baseUrl
    },
    credentialsConfigured: Boolean(credentials.clientId && credentials.clientSecret),
    totalPaymentsRecorded: totalPayments,
    serverTime: new Date().toISOString(),
    supportedPlans: Object.keys(PRICING_CATALOG)
  });
}

// ============================================================
// HELPER FUNCTIONS & SHEET CREATION
// ============================================================

/**
 * Resolves the active environment ('sandbox' or 'production').
 * Priority:
 * 1. Script Properties: 'QPZ_ENVIRONMENT'
 * 2. GATEWAY_CONFIG.defaultEnvironment
 */
function getActiveEnvironment() {
  var props = PropertiesService.getScriptProperties();
  var envKey = (props.getProperty("QPZ_ENVIRONMENT") || GATEWAY_CONFIG.defaultEnvironment || "sandbox").toLowerCase();
  var envObj = GATEWAY_CONFIG.environments[envKey] || GATEWAY_CONFIG.environments.sandbox;
  return {
    key: envKey,
    name: envObj.name,
    baseUrl: envObj.baseUrl
  };
}

/**
 * Retrieves client credentials from Script Properties.
 */
function getGatewayCredentials() {
  var props = PropertiesService.getScriptProperties();
  return {
    clientId: (props.getProperty("QPZ_CLIENT_ID") || "").trim(),
    clientSecret: (props.getProperty("QPZ_CLIENT_SECRET") || "").trim()
  };
}

/**
 * Resolves pricing details server-side to guarantee integrity.
 */
function resolvePlanPricing(planKey, billingCycle) {
  var key = (planKey || "starter").toLowerCase();
  var plan = PRICING_CATALOG[key] || PRICING_CATALOG.starter;
  var isYearly = (billingCycle || "").toLowerCase() === "yearly";
  var rate = isYearly ? plan.yearly : plan.monthly;

  return {
    planKey: plan.key || key,
    planName: plan.name + " (" + (isYearly ? "Annual" : "Monthly") + ")",
    billingCycle: isYearly ? "yearly" : "monthly",
    cents: rate.cents,
    formattedPrice: rate.formatted,
    durationDays: rate.durationDays
  };
}

/**
 * Translates Q PaymentZ decline codes into clear user-facing messages.
 */
function getDeclineUserMessage(code) {
  var messages = {
    declined_insufficient_funds: "Payment declined: Insufficient funds in the account.",
    declined_do_not_honor: "Payment declined by issuing bank (Do Not Honor). Please contact your card issuer.",
    declined_expired_card: "Payment declined: Card has expired. Please check expiry date.",
    declined_incorrect_number: "Payment declined: Invalid card number.",
    declined_cvv: "Payment declined: Incorrect CVV / security code.",
    declined_avs: "Payment declined: Billing address or postal code mismatch.",
    declined_fraud: "Payment declined: Flagged by fraud security filters.",
    declined_generic: "Payment declined by payment processor. Please try another card."
  };
  return messages[code] || ("Payment declined (" + (code || "unspecified") + "). Please verify card details.");
}

/**
 * Ensures the "Payments" ledger sheet exists with standard columns.
 */
function getOrCreatePaymentsSheet(ss) {
  return getOrCreateSheet(ss, "Payments", [
    "Transaction ID",
    "Timestamp (ISO)",
    "Tenant ID",
    "Admin Email",
    "Plan Name",
    "Plan Key",
    "Billing Cycle",
    "Amount Paid",
    "Amount (Cents)",
    "Status",
    "Card Brand",
    "Last 4",
    "Auth Code",
    "Environment",
    "Idempotency Key"
  ]);
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#F1F3F4");
  }
  return sheet;
}

function parseRequestData(e) {
  var data = {};
  if (e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      data = e.parameter || {};
    }
  } else if (e.parameter) {
    data = e.parameter;
  }
  return data;
}

function responseJSON(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
