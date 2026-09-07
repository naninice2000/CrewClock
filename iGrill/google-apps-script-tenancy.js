/**
 * Google Apps Script for SheetPunch Multi-Tenant Platform
 * -------------------------------------------------------------
 * INSTRUCTIONS:
 * 1. Open Google Sheets and create a NEW spreadsheet (https://sheets.new).
 *    Name it: "SheetPunch - Tenants & Users Directory"
 * 2. In the top menu, click Extensions > Apps Script.
 * 3. Delete any code in the editor and paste this entire script.
 * 4. Click "Deploy" (top right blue button) > "New deployment".
 * 5. Click the gear icon next to "Select type" and choose "Web app".
 *    - Description: "SheetPunch Multi-Tenancy & RBAC Directory"
 *    - Execute as: "Me (your email)"
 *    - Who has access: "Anyone"
 * 6. Click "Deploy", authorize access, and copy the "Web app URL".
 * 7. Paste this URL into config.js as `tenancyScriptUrl` (or in Settings).
 */

function doPost(e) {
  return handleTenancyRequest(e);
}

function doGet(e) {
  return handleTenancyRequest(e);
}

function handleTenancyRequest(e) {
  try {
    e = e || {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tenantsSheet = getOrCreateSheet(ss, "Tenants", [
      "Tenant ID",
      "Restaurant Name",
      "Logo URL",
      "Admin Email",
      "Attendance Sheet URL",
      "Time Zone",
      "Created At",
      "Subscription Status",
      "Trial Ends At",
      "Plan",
      "Billing Cycle",
      "Paid Amount",
      "Payment Date",
      "Payment Reference",
      "Subscription Ends At"
    ]);
    var usersSheet = getOrCreateSheet(ss, "Users", [
      "User Email",
      "User Name",
      "Role",
      "Tenant ID",
      "Status",
      "Invited By",
      "Created At"
    ]);

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

    var action = (data.action || "").toLowerCase();
    var email = (data.email || "").trim().toLowerCase();
    var nowIso = new Date().toISOString();

    // Default / Health Check
    if (!action || action === "health") {
      var serviceEmail = "";
      try {
        serviceEmail = Session.getEffectiveUser().getEmail();
      } catch (e) {}
      return responseJSON({
        success: true,
        service: "SheetPunch Multi-Tenant Directory",
        serviceEmail: serviceEmail,
        serverTimeIso: nowIso,
        timeZone: ss.getSpreadsheetTimeZone(),
        totalTenants: Math.max(0, tenantsSheet.getLastRow() - 1),
        totalUsers: Math.max(0, usersSheet.getLastRow() - 1)
      });
    }

    // Check User / Authentication Routing
    if (action === "check_user") {
      if (!email) return responseJSON({ success: false, error: "Email is required" });
      var user = findUserByEmail(usersSheet, email);
      if (!user) {
        return responseJSON({
          success: true,
          exists: false,
          message: "User not found. Needs invitation or signup."
        });
      }

      var tenant = findTenantById(tenantsSheet, user.tenantId);
      return responseJSON({
        success: true,
        exists: true,
        user: user,
        tenant: tenant,
        subscription: tenant ? tenant.subscription : null
      });
    }

    // ============================================================
    // ACTION 1: ADMIN SIGNUP (Create Tenant & Register Admin User with 14-Day Free Trial)
    // ============================================================
    if (action === "signup") {
      if (!email) return responseJSON({ success: false, error: "Email is required for signup" });

      // Check if user already exists
      var existingUser = findUserByEmail(usersSheet, email);
      if (existingUser) {
        // Return existing tenant info
        var tenant = findTenantById(tenantsSheet, existingUser.tenantId);
        return responseJSON({
          success: true,
          message: "User already registered",
          alreadyRegistered: true,
          user: existingUser,
          tenant: tenant,
          subscription: tenant ? tenant.subscription : null
        });
      }

      var businessName = data.businessName || data.restaurantName || "My Business";
      var restaurantName = businessName;
      var logoUrl = data.logoUrl || "";
      var attendanceScriptUrl = data.attendanceSheetId || data.attendanceScriptUrl || "";
      var timeZone = data.timeZone || "America/Los_Angeles";
      var tenantId = "t_" + Utilities.getUuid().slice(0, 8);
      var adminName = data.name || "Business Admin";
      
      // Calculate 14-day free trial dates
      var trialDurationMs = 14 * 24 * 60 * 60 * 1000;
      var trialEndsAt = new Date(Date.now() + trialDurationMs).toISOString();

      // 1. Append to Tenants sheet (Cols 1 to 15)
      tenantsSheet.appendRow([
        tenantId,
        restaurantName,
        logoUrl,
        email,
        attendanceScriptUrl,
        timeZone,
        nowIso,
        "trial",        // Col 8: Subscription Status
        trialEndsAt,    // Col 9: Trial Ends At (14 days)
        "Free Trial",   // Col 10: Plan
        "trial",        // Col 11: Billing Cycle
        "$0.00",        // Col 12: Paid Amount
        "",             // Col 13: Payment Date
        "",             // Col 14: Payment Reference
        trialEndsAt     // Col 15: Subscription Ends At
      ]);

      // 2. Append to Users sheet (Role: admin)
      usersSheet.appendRow([
        email,
        adminName,
        "admin",
        tenantId,
        "active",
        email,
        nowIso
      ]);

      removeCached("user:" + email);
      removeCached("tenant:" + tenantId);

      var newTenant = findTenantById(tenantsSheet, tenantId);

      return responseJSON({
        success: true,
        message: "Business workspace created successfully with 14-day Free Trial!",
        tenant: newTenant,
        subscription: newTenant ? newTenant.subscription : null,
        user: {
          email: email,
          name: adminName,
          role: "admin",
          tenantId: tenantId,
          status: "active"
        }
      });

    // ============================================================
    // ACTION 2: INVITE EMPLOYEE (Admin invites staff by Gmail)
    // ============================================================
    } else if (action === "invite_employee") {
      var adminEmail = (data.adminEmail || "").trim().toLowerCase();
      var inviteEmail = (data.inviteEmail || "").trim().toLowerCase();
      var inviteName = data.inviteName || "Staff Member";
      var appUrl = data.appUrl || "https://naninice2000.github.io/CrewClock/iGrill/";

      if (!adminEmail || !inviteEmail) {
        return responseJSON({ success: false, error: "Both adminEmail and inviteEmail are required" });
      }

      // Verify caller is admin
      var adminUser = findUserByEmail(usersSheet, adminEmail);
      if (!adminUser || adminUser.role !== "admin") {
        return responseJSON({ success: false, error: "Only an authorized business Admin can invite employees." });
      }

      var tenantId = adminUser.tenantId;
      var tenant = findTenantById(tenantsSheet, tenantId);
      var businessName = tenant ? (tenant.businessName || tenant.restaurantName) : "the business";

      // Check if employee already invited
      var existingEmployee = findUserByEmail(usersSheet, inviteEmail);
      if (existingEmployee) {
        if (existingEmployee.tenantId === tenantId) {
          return responseJSON({ success: false, error: "Employee is already a member of your team." });
        } else {
          return responseJSON({ success: false, error: "This Gmail address is already registered with another business." });
        }
      }

      // Add to Users sheet
      usersSheet.appendRow([
        inviteEmail,
        inviteName,
        "employee",
        tenantId,
        "active",
        adminEmail,
        nowIso
      ]);

      removeCached("user:" + inviteEmail);

      // Send Gmail Invitation using MailApp
      try {
        var subject = "You're invited to join " + businessName + " on SheetPunch";
        var body = "Hello " + inviteName + ",\n\n" +
          adminUser.name + " (" + adminEmail + ") has invited you to join " + businessName + " on SheetPunch for attendance and time tracking.\n\n" +
          "To access your shift portal and clock in, open the link below and Sign In with your Google account:\n" +
          appUrl + "\n\n" +
          "Best regards,\n" +
          businessName + " Team";

        MailApp.sendEmail(inviteEmail, subject, body);
      } catch (mailErr) {
        console.warn("MailApp warning:", mailErr);
      }

      return responseJSON({
        success: true,
        message: "Invitation recorded and sent to " + inviteEmail,
        employee: {
          email: inviteEmail,
          name: inviteName,
          role: "employee",
          tenantId: tenantId,
          status: "active"
        }
      });

    // ============================================================
    // ACTION 3: GET TEAM (Admin views all staff under their tenant)
    // ============================================================
    } else if (action === "get_team") {
      var adminEmail = (data.adminEmail || "").trim().toLowerCase();
      var adminUser = findUserByEmail(usersSheet, adminEmail);
      if (!adminUser || adminUser.role !== "admin") {
        return responseJSON({ success: false, error: "Unauthorized access" });
      }

      var team = getTeamByTenantId(usersSheet, adminUser.tenantId);
      return responseJSON({
        success: true,
        team: team
      });

    // ============================================================
    // ACTION 4: REMOVE EMPLOYEE
    // ============================================================
    } else if (action === "remove_employee") {
      var adminEmail = (data.adminEmail || "").trim().toLowerCase();
      var targetEmail = (data.targetEmail || "").trim().toLowerCase();

      var adminUser = findUserByEmail(usersSheet, adminEmail);
      if (!adminUser || adminUser.role !== "admin") {
        return responseJSON({ success: false, error: "Unauthorized access" });
      }

      if (adminEmail === targetEmail) {
        return responseJSON({ success: false, error: "Admins cannot remove themselves." });
      }

      var removed = removeUser(usersSheet, targetEmail, adminUser.tenantId);
      return responseJSON({
        success: removed,
        message: removed ? "Employee removed from team" : "Employee not found"
      });

    // ============================================================
    // ACTION 5: UPDATE TENANT CONFIG (Admin updates branding/sheet URL)
    // ============================================================
    } else if (action === "update_config") {
      var adminEmail = (data.adminEmail || "").trim().toLowerCase();
      var adminUser = findUserByEmail(usersSheet, adminEmail);
      if (!adminUser || adminUser.role !== "admin") {
        return responseJSON({ success: false, error: "Unauthorized access" });
      }

      var bName = data.businessName || data.restaurantName;
      var updated = updateTenant(tenantsSheet, adminUser.tenantId, {
        businessName: bName,
        restaurantName: bName,
        logoUrl: data.logoUrl,
        attendanceScriptUrl: data.attendanceSheetId || data.attendanceScriptUrl,
        timeZone: data.timeZone
      });

      return responseJSON({
        success: true,
        message: "Business configuration updated!",
        tenant: updated
      });

    // ============================================================
    // ACTION 6: LOG ATTENDANCE SHIFT (Tamper-Proof Proxy Write to Merchant Sheet)
    // ============================================================
    } else if (action === "log_shift") {
      var userEmail = (data.email || "").trim().toLowerCase();
      var tenantId = (data.tenantId || "").trim();
      var subAction = (data.subAction || "clockin").toLowerCase(); // 'clockin' | 'clockout'

      if (!userEmail || !tenantId) {
        return responseJSON({ success: false, error: "Both email and tenantId are required to log shift" });
      }

      // 1. Verify user belongs to this tenant workspace
      var user = findUserByEmail(usersSheet, userEmail);
      if (!user || user.tenantId !== tenantId) {
        return responseJSON({ success: false, error: "Unauthorized: Staff member is not registered in this business workspace." });
      }

      // 2. Look up tenant to get the merchant's attendanceSheetId
      var tenant = findTenantById(tenantsSheet, tenantId);
      if (!tenant) {
        return responseJSON({ success: false, error: "Business workspace not found." });
      }

      var bName = tenant.businessName || tenant.restaurantName || "your business";

      // 2.1 Verify Tenant Subscription or Free Trial is Valid
      if (tenant.subscription && !tenant.subscription.isValid) {
        return responseJSON({
          success: false,
          expired: true,
          error: "Subscription Required: The 14-day free trial for " + bName + " has expired. The business administrator must activate a subscription via the SheetPunch Web Portal to continue logging attendance shifts."
        });
      }

      var targetSheet = tenant.attendanceScriptUrl || "";
      var sheetId = extractSpreadsheetIdFromStr(targetSheet);
      if (!sheetId) {
        return responseJSON({ success: false, error: "No valid Google Sheet ID configured for this business." });
      }

      // 3. Open Merchant's Google Sheet
      var merchantSs;
      try {
        merchantSs = SpreadsheetApp.openById(sheetId);
      } catch (openErr) {
        var hostEmail = "";
        try { hostEmail = Session.getEffectiveUser().getEmail(); } catch (e) {}
        return responseJSON({
          success: false,
          error: "Permission Denied: Could not open business Google Sheet. Please ensure the business Owner opened their sheet (https://docs.google.com/spreadsheets/d/" + sheetId + "/edit) and shared it with " + (hostEmail || "the platform service email") + " as Editor."
        });
      }

      // 4. Ensure Attendance tab exists
      var attHeaders = [
        "Date",
        "Employee Name",
        "Email",
        "Clock In Time",
        "Clock In Coordinates",
        "Clock In Map",
        "Clock Out Time",
        "Shift Duration",
        "Clock Out Coordinates",
        "Clock Out Map",
        "Status"
      ];
      var attSheet = getOrCreateSheet(merchantSs, "Attendance", attHeaders);

      // Determine Server Time for accuracy
      var tz = tenant.timeZone || "America/Los_Angeles";
      var serverNow = new Date();
      var dateFormatted = Utilities.formatDate(serverNow, tz, "MMM dd, yyyy");
      var timeFormatted = Utilities.formatDate(serverNow, tz, "MMM dd, yyyy hh:mm:ss a");

      var lat = data.latitude || "";
      var lng = data.longitude || "";
      var coords = (lat && lng) ? (lat + ", " + lng) : "";
      var mapsUrl = (lat && lng) ? ("https://www.google.com/maps?q=" + lat + "," + lng) : "";

      // 5. Execute Clock-In
      if (subAction === "clockin") {
        attSheet.appendRow([
          dateFormatted,
          data.name || user.name || "Employee",
          userEmail,
          data.timestamp || timeFormatted,
          coords,
          mapsUrl,
          "", // Clock Out Time
          "", // Duration
          "", // Clock Out Coordinates
          "", // Clock Out Map
          "Clocked In"
        ]);
        var newRow = attSheet.getLastRow();
        return responseJSON({
          success: true,
          action: "clockin",
          rowNumber: newRow,
          tabName: "Attendance",
          serverTimeIso: serverNow.toISOString()
        });
      }

      // 6. Execute Clock-Out
      if (subAction === "clockout") {
        var targetRow = parseInt(data.sheetRow, 10);
        var lastRow = attSheet.getLastRow();

        // If targetRow not provided or invalid, search bottom to top for active shift
        if (!targetRow || targetRow < 2 || targetRow > lastRow) {
          targetRow = findOpenShiftRowIndex(attSheet, userEmail);
        }

        var durationStr = data.duration || "0m";

        if (targetRow && targetRow >= 2) {
          // Update columns G:K (Cols 7 to 11)
          attSheet.getRange(targetRow, 7, 1, 5).setValues([[
            data.timestamp || timeFormatted,
            durationStr,
            coords,
            mapsUrl,
            "Completed"
          ]]);

          return responseJSON({
            success: true,
            action: "clockout",
            rowNumber: targetRow,
            tabName: "Attendance",
            serverTimeIso: serverNow.toISOString()
          });
        } else {
          // Graceful fallback: append completed row
          attSheet.appendRow([
            data.clockInDate || dateFormatted,
            data.name || user.name || "Employee",
            userEmail,
            data.clockInTime || "--",
            data.inCoords || "",
            data.inMapsUrl || "",
            data.timestamp || timeFormatted,
            durationStr,
            coords,
            mapsUrl,
            "Completed"
          ]);
          return responseJSON({
            success: true,
            action: "clockout",
            rowNumber: attSheet.getLastRow(),
            tabName: "Attendance",
            serverTimeIso: serverNow.toISOString()
          });
        }
      }

      return responseJSON({ success: false, error: "Unknown subAction: " + subAction });
    }

    // ============================================================
    // ACTION 6b: BATCH LOG ATTENDANCE SHIFTS (High-Throughput Buffer Flush)
    // ============================================================
    else if (action === "batch_log_shifts") {
      var rawShifts = data.shifts || [];
      if (!Array.isArray(rawShifts) || rawShifts.length === 0) {
        return responseJSON({ success: false, error: "shifts array is required and cannot be empty" });
      }

      var results = [];
      var tenantCacheMap = {};
      var userCacheMap = {};
      var sheetGroups = {}; // sheetId -> { tenant, items: [] }

      // 1. Validate permissions and group punches by merchant Google Sheet
      for (var s = 0; s < rawShifts.length; s++) {
        var shift = rawShifts[s];
        var uEmail = (shift.email || "").trim().toLowerCase();
        var tId = (shift.tenantId || "").trim();
        var sAction = (shift.subAction || "clockin").toLowerCase();

        if (!uEmail || !tId) {
          results.push({ id: shift.id || ("shift_" + s), success: false, error: "Missing email or tenantId" });
          continue;
        }

        // Cached lookup
        var user = userCacheMap[uEmail] || findUserByEmail(usersSheet, uEmail);
        if (user) userCacheMap[uEmail] = user;
        if (!user || user.tenantId !== tId) {
          results.push({ id: shift.id || ("shift_" + s), success: false, error: "Unauthorized: User not found in workspace" });
          continue;
        }

        var tenant = tenantCacheMap[tId] || findTenantById(tenantsSheet, tId);
        if (tenant) tenantCacheMap[tId] = tenant;
        if (!tenant) {
          results.push({ id: shift.id || ("shift_" + s), success: false, error: "Business workspace not found" });
          continue;
        }

        if (tenant.subscription && !tenant.subscription.isValid) {
          results.push({ id: shift.id || ("shift_" + s), success: false, expired: true, error: "Subscription expired" });
          continue;
        }

        var targetSheet = tenant.attendanceScriptUrl || "";
        var sheetId = extractSpreadsheetIdFromStr(targetSheet);
        if (!sheetId) {
          results.push({ id: shift.id || ("shift_" + s), success: false, error: "No valid Google Sheet configured" });
          continue;
        }

        if (!sheetGroups[sheetId]) {
          sheetGroups[sheetId] = {
            tenant: tenant,
            items: []
          };
        }
        sheetGroups[sheetId].items.push({
          shift: shift,
          user: user,
          tenant: tenant,
          subAction: sAction,
          userEmail: uEmail
        });
      }

      // 2. Execute batched writes per merchant sheet in a single open session
      var attHeaders = [
        "Date", "Employee Name", "Email", "Clock In Time", "Clock In Coordinates",
        "Clock In Map", "Clock Out Time", "Shift Duration", "Clock Out Coordinates",
        "Clock Out Map", "Status"
      ];

      for (var sId in sheetGroups) {
        if (!sheetGroups.hasOwnProperty(sId)) continue;
        var group = sheetGroups[sId];
        var merchantSs;
        try {
          merchantSs = SpreadsheetApp.openById(sId);
        } catch (openErr) {
          for (var eIdx = 0; eIdx < group.items.length; eIdx++) {
            results.push({
              id: group.items[eIdx].shift.id || ("shift_" + eIdx),
              success: false,
              error: "Permission Denied: Could not open sheet ID " + sId
            });
          }
          continue;
        }

        var attSheet = getOrCreateSheet(merchantSs, "Attendance", attHeaders);
        var tz = group.tenant.timeZone || "America/Los_Angeles";
        var serverNow = new Date();

        for (var i = 0; i < group.items.length; i++) {
          var item = group.items[i];
          var raw = item.shift;
          var dateFormatted = Utilities.formatDate(serverNow, tz, "MMM dd, yyyy");
          var timeFormatted = Utilities.formatDate(serverNow, tz, "MMM dd, yyyy hh:mm:ss a");
          var lat = raw.latitude || "";
          var lng = raw.longitude || "";
          var coords = (lat && lng) ? (lat + ", " + lng) : "";
          var mapsUrl = (lat && lng) ? ("https://www.google.com/maps?q=" + lat + "," + lng) : "";

          if (item.subAction === "clockin") {
            attSheet.appendRow([
              dateFormatted,
              raw.name || item.user.name || "Staff Member",
              item.userEmail,
              raw.timestamp || timeFormatted,
              coords,
              mapsUrl,
              "", "", "", "",
              "Clocked In"
            ]);
            results.push({
              id: raw.id || ("shift_" + i),
              success: true,
              action: "clockin",
              rowNumber: attSheet.getLastRow(),
              tabName: "Attendance",
              serverTimeIso: serverNow.toISOString()
            });
          } else {
            // Clock-out
            var targetRow = parseInt(raw.sheetRow, 10);
            if (!targetRow || targetRow < 2 || targetRow > attSheet.getLastRow()) {
              targetRow = findOpenShiftRowIndex(attSheet, item.userEmail);
            }
            var durationStr = raw.duration || "0m";
            if (targetRow && targetRow >= 2) {
              attSheet.getRange(targetRow, 7, 1, 5).setValues([[
                raw.timestamp || timeFormatted,
                durationStr,
                coords,
                mapsUrl,
                "Completed"
              ]]);
              results.push({
                id: raw.id || ("shift_" + i),
                success: true,
                action: "clockout",
                rowNumber: targetRow,
                tabName: "Attendance",
                serverTimeIso: serverNow.toISOString()
              });
            } else {
              attSheet.appendRow([
                dateFormatted,
                raw.name || item.user.name || "Staff Member",
                item.userEmail,
                raw.clockInTime || timeFormatted,
                "", "",
                raw.timestamp || timeFormatted,
                durationStr,
                coords,
                mapsUrl,
                "Completed"
              ]);
              results.push({
                id: raw.id || ("shift_" + i),
                success: true,
                action: "clockout",
                rowNumber: attSheet.getLastRow(),
                tabName: "Attendance",
                note: "Appended new row (no open shift found)"
              });
            }
          }
        }
      }

      return responseJSON({
        success: true,
        action: "batch_log_shifts",
        processed: results.length,
        results: results
      });
    }
    else if (action === "record_payment") {
      var adminEmail = (data.adminEmail || "").trim().toLowerCase();
      var tenantId = (data.tenantId || "").trim();
      var plan = data.plan || "Monthly Pro";
      var billingCycle = (data.billingCycle || "monthly").toLowerCase();
      var paidAmount = data.paidAmount || (billingCycle === "yearly" ? "$290.00" : "$29.00");
      var paymentRef = data.paymentRef || ("PAY_" + Utilities.getUuid().slice(0, 8).toUpperCase());
      var durationDays = parseInt(data.durationDays || (billingCycle === "yearly" ? 365 : 30), 10);
      var platform = (data.platform || "web").toLowerCase();

      if (!adminEmail || !tenantId) {
        return responseJSON({ success: false, error: "Both adminEmail and tenantId are required to record payment" });
      }

      // Verify caller is admin of this tenant
      var adminUser = findUserByEmail(usersSheet, adminEmail);
      if (!adminUser || adminUser.role !== "admin" || adminUser.tenantId !== tenantId) {
        return responseJSON({ success: false, error: "Unauthorized: Only an authorized Admin can manage subscriptions." });
      }

      var tenant = findTenantById(tenantsSheet, tenantId);
      if (!tenant) {
        return responseJSON({ success: false, error: "Tenant workspace not found" });
      }

      // Calculate new subscription end date
      var now = new Date();
      var baseDate = now;
      if (tenant.subscriptionEndsAt) {
        var existingEnd = new Date(tenant.subscriptionEndsAt);
        if (existingEnd.getTime() > now.getTime()) {
          baseDate = existingEnd; // Extend from current expiration date
        }
      }
      var newSubscriptionEnd = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      // Update tenant row in Tenants sheet
      var updated = updateTenantSubscription(tenantsSheet, tenantId, {
        subscriptionStatus: "active",
        plan: plan,
        billingCycle: billingCycle,
        paidAmount: paidAmount,
        paymentDate: nowIso,
        paymentRef: paymentRef,
        subscriptionEndsAt: newSubscriptionEnd
      });

      return responseJSON({
        success: true,
        message: "Payment processed successfully! Your subscription is now active.",
        tenant: updated,
        subscription: updated ? updated.subscription : null,
        payment: {
          plan: plan,
          billingCycle: billingCycle,
          paidAmount: paidAmount,
          paymentRef: paymentRef,
          platform: platform,
          paymentDate: nowIso,
          subscriptionEndsAt: newSubscriptionEnd
        }
      });
    }

    return responseJSON({ success: false, error: "Unknown action: " + action });

  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}


// ============================================================
// SHEET UTILITY HELPERS
// ============================================================
function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#F1F5F9");
    sheet.setFrozenRows(1);
  } else {
    // Automatically migrate and append any new columns to existing sheet
    try {
      var lastCol = sheet.getLastColumn();
      if (lastCol > 0 && lastCol < headers.length) {
        var existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        for (var h = existingHeaders.length; h < headers.length; h++) {
          sheet.getRange(1, h + 1).setValue(headers[h]).setFontWeight("bold").setBackground("#F1F5F9");
        }
      }
    } catch (migErr) {
      console.warn("Header migration note:", migErr);
    }
  }
  return sheet;
}

// ============================================================
// CACHE SERVICE HELPERS (Server-Side In-Memory Cache)
// ============================================================
var CACHE_TTL_SECONDS = 900; // 15 minutes default TTL

function getCacheStore() {
  try {
    if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
      return CacheService.getScriptCache();
    }
  } catch (e) {
    console.warn("CacheService not available in current runtime:", e);
  }
  return null;
}

function getCached(key) {
  try {
    var cache = getCacheStore();
    if (!cache) return null;
    var val = cache.get(key);
    if (!val) return null;
    return JSON.parse(val);
  } catch (e) {
    return null;
  }
}

function setCached(key, data, ttlSeconds) {
  try {
    var cache = getCacheStore();
    if (!cache) return;
    var ttl = ttlSeconds || CACHE_TTL_SECONDS;
    cache.put(key, JSON.stringify(data), ttl);
  } catch (e) {
    console.warn("Error setting cache for key " + key, e);
  }
}

function removeCached(key) {
  try {
    var cache = getCacheStore();
    if (!cache) return;
    cache.remove(key);
  } catch (e) {
    console.warn("Error removing cache for key " + key, e);
  }
}

function refreshDynamicSubscription(tenant) {
  if (!tenant) return null;
  var now = new Date();
  var trialEndsAt = tenant.trialEndsAt;
  var subscriptionEndsAt = tenant.subscriptionEndsAt || trialEndsAt;
  var trialEndDate = new Date(trialEndsAt);
  var subEndDate = new Date(subscriptionEndsAt);
  var rawStatus = (tenant.subscriptionStatus || "trial").toString().toLowerCase();
  var isPaid = rawStatus === "active";
  var isPaidActive = isPaid && subEndDate.getTime() > now.getTime();
  var isTrialActive = !isPaid && trialEndDate.getTime() > now.getTime();
  var isValid = isPaidActive || isTrialActive;

  var effectiveEndDate = isPaidActive ? subEndDate : trialEndDate;
  var daysRemaining = Math.max(0, Math.ceil((effectiveEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  var dynamicStatus = isPaidActive ? "active" : (isTrialActive ? "trial" : "expired");

  tenant.subscriptionStatus = dynamicStatus;
  if (!tenant.subscription) tenant.subscription = {};
  tenant.subscription.status = dynamicStatus;
  tenant.subscription.isTrial = isTrialActive;
  tenant.subscription.isPaid = isPaidActive;
  tenant.subscription.isValid = isValid;
  tenant.subscription.daysRemaining = daysRemaining;
  return tenant;
}

function findUserByEmail(usersSheet, email) {
  if (!email) return null;
  var cleanEmail = email.trim().toLowerCase();
  var cacheKey = "user:" + cleanEmail;
  var cached = getCached(cacheKey);
  if (cached) return cached;

  var lastRow = usersSheet.getLastRow();
  if (lastRow <= 1) return null;
  var rows = usersSheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][0] || "").toString().trim().toLowerCase() === cleanEmail) {
      var user = {
        email: rows[i][0],
        name: rows[i][1],
        role: rows[i][2],
        tenantId: rows[i][3],
        status: rows[i][4],
        invitedBy: rows[i][5],
        createdAt: rows[i][6]
      };
      setCached(cacheKey, user, CACHE_TTL_SECONDS);
      return user;
    }
  }
  return null;
}

function findTenantById(tenantsSheet, tenantId) {
  if (!tenantId) return null;
  var cleanTenantId = tenantId.trim();
  var cacheKey = "tenant:" + cleanTenantId;
  var cached = getCached(cacheKey);
  if (cached) {
    return refreshDynamicSubscription(cached);
  }

  var lastRow = tenantsSheet.getLastRow();
  if (lastRow <= 1) return null;
  var colCount = Math.max(15, tenantsSheet.getLastColumn());
  var rows = tenantsSheet.getRange(2, 1, lastRow - 1, colCount).getValues();
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][0] || "").toString().trim() === cleanTenantId) {
      var createdAt = rows[i][6] || new Date().toISOString();
      var trialEndsAt = rows[i][8];
      if (!trialEndsAt) {
        var createdDate = new Date(createdAt);
        if (isNaN(createdDate.getTime())) createdDate = new Date();
        trialEndsAt = new Date(createdDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
      }

      var rawStatus = (rows[i][7] || "trial").toString().toLowerCase();
      var plan = rows[i][9] || "Free Trial";
      var billingCycle = rows[i][10] || "trial";
      var paidAmount = rows[i][11] || "$0.00";
      var paymentDate = rows[i][12] || "";
      var paymentRef = rows[i][13] || "";
      var subscriptionEndsAt = rows[i][14] || trialEndsAt;

      // Dynamic validity computation
      var now = new Date();
      var trialEndDate = new Date(trialEndsAt);
      var subEndDate = new Date(subscriptionEndsAt);
      var isPaid = rawStatus === "active";
      var isPaidActive = isPaid && subEndDate.getTime() > now.getTime();
      var isTrialActive = !isPaid && trialEndDate.getTime() > now.getTime();
      var isValid = isPaidActive || isTrialActive;

      var effectiveEndDate = isPaidActive ? subEndDate : trialEndDate;
      var daysRemaining = Math.max(0, Math.ceil((effectiveEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      var dynamicStatus = isPaidActive ? "active" : (isTrialActive ? "trial" : "expired");

      var tenant = {
        tenantId: rows[i][0],
        restaurantName: rows[i][1],
        businessName: rows[i][1],
        logoUrl: rows[i][2],
        adminEmail: rows[i][3],
        attendanceScriptUrl: rows[i][4],
        timeZone: rows[i][5],
        createdAt: createdAt,
        subscriptionStatus: dynamicStatus,
        trialEndsAt: trialEndsAt,
        plan: plan,
        billingCycle: billingCycle,
        paidAmount: paidAmount,
        paymentDate: paymentDate,
        paymentRef: paymentRef,
        subscriptionEndsAt: subscriptionEndsAt,
        subscription: {
          status: dynamicStatus,
          plan: plan,
          billingCycle: billingCycle,
          isTrial: isTrialActive,
          isPaid: isPaidActive,
          isValid: isValid,
          daysRemaining: daysRemaining,
          trialEndsAt: trialEndsAt,
          subscriptionEndsAt: subscriptionEndsAt,
          paidAmount: paidAmount,
          paymentRef: paymentRef
        }
      };
      setCached(cacheKey, tenant, CACHE_TTL_SECONDS);
      return tenant;
    }
  }
  return null;
}

function updateTenantSubscription(tenantsSheet, tenantId, sub) {
  var lastRow = tenantsSheet.getLastRow();
  if (lastRow <= 1) return null;
  var rows = tenantsSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][0] || "").toString().trim() === tenantId) {
      var rowNum = i + 2;
      tenantsSheet.getRange(rowNum, 8).setValue(sub.subscriptionStatus);
      tenantsSheet.getRange(rowNum, 10).setValue(sub.plan);
      tenantsSheet.getRange(rowNum, 11).setValue(sub.billingCycle);
      tenantsSheet.getRange(rowNum, 12).setValue(sub.paidAmount);
      tenantsSheet.getRange(rowNum, 13).setValue(sub.paymentDate);
      tenantsSheet.getRange(rowNum, 14).setValue(sub.paymentRef);
      tenantsSheet.getRange(rowNum, 15).setValue(sub.subscriptionEndsAt);
      removeCached("tenant:" + tenantId.trim());
      return findTenantById(tenantsSheet, tenantId);
    }
  }
  return null;
}

function getTeamByTenantId(usersSheet, tenantId) {
  var lastRow = usersSheet.getLastRow();
  if (lastRow <= 1) return [];
  var rows = usersSheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var team = [];
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][3] || "").toString().trim() === tenantId) {
      team.push({
        email: rows[i][0],
        name: rows[i][1],
        role: rows[i][2],
        tenantId: rows[i][3],
        status: rows[i][4],
        invitedBy: rows[i][5],
        createdAt: rows[i][6]
      });
    }
  }
  return team;
}

function removeUser(usersSheet, email, tenantId) {
  var lastRow = usersSheet.getLastRow();
  if (lastRow <= 1) return false;
  var cleanEmail = (email || "").toString().trim().toLowerCase();
  var rows = usersSheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][0] || "").toString().trim().toLowerCase() === cleanEmail && (rows[i][3] || "").toString().trim() === tenantId) {
      usersSheet.deleteRow(i + 2);
      removeCached("user:" + cleanEmail);
      return true;
    }
  }
  return false;
}

function updateTenant(tenantsSheet, tenantId, updates) {
  var lastRow = tenantsSheet.getLastRow();
  if (lastRow <= 1) return null;
  var cleanTenantId = (tenantId || "").toString().trim();
  var rows = tenantsSheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][0] || "").toString().trim() === cleanTenantId) {
      var rowNum = i + 2;
      var bName = updates.businessName || updates.restaurantName;
      if (bName) tenantsSheet.getRange(rowNum, 2).setValue(bName);
      if (updates.logoUrl !== undefined) tenantsSheet.getRange(rowNum, 3).setValue(updates.logoUrl);
      if (updates.attendanceScriptUrl) tenantsSheet.getRange(rowNum, 5).setValue(updates.attendanceScriptUrl);
      if (updates.timeZone) tenantsSheet.getRange(rowNum, 6).setValue(updates.timeZone);
      removeCached("tenant:" + cleanTenantId);
      return findTenantById(tenantsSheet, tenantId);
    }
  }
  return null;
}

function extractSpreadsheetIdFromStr(str) {
  if (!str) return "";
  var clean = str.trim();
  var match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(clean) && clean.indexOf("script.google.com") === -1) {
    return clean;
  }
  return clean;
}

function findOpenShiftRowIndex(attSheet, userEmail) {
  var lastRow = attSheet.getLastRow();
  if (lastRow <= 1) return 0;
  var rows = attSheet.getRange(2, 1, lastRow - 1, 11).getValues();
  for (var i = rows.length - 1; i >= 0; i--) {
    var row = rows[i];
    var email = (row[2] || "").toString().trim().toLowerCase();
    var clockOut = (row[6] || "").toString().trim();
    var status = (row[10] || "").toString().trim();
    if (email === userEmail && (!clockOut || status === "Clocked In")) {
      return i + 2; // 1-indexed (row 1 is header)
    }
  }
  return 0;
}

function responseJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
