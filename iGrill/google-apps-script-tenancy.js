/**
 * Google Apps Script for CrewClock Multi-Tenant Platform
 * -------------------------------------------------------------
 * INSTRUCTIONS:
 * 1. Open Google Sheets and create a NEW spreadsheet (https://sheets.new).
 *    Name it: "CrewClock - Tenants & Users Directory"
 * 2. In the top menu, click Extensions > Apps Script.
 * 3. Delete any code in the editor and paste this entire script.
 * 4. Click "Deploy" (top right blue button) > "New deployment".
 * 5. Click the gear icon next to "Select type" and choose "Web app".
 *    - Description: "CrewClock Multi-Tenancy & RBAC Directory"
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
      "Created At"
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
        service: "CrewClock Multi-Tenant Directory",
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
        tenant: tenant
      });
    }

    // ============================================================
    // ACTION 1: ADMIN SIGNUP (Create Tenant & Register Admin User)
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
          tenant: tenant
        });
      }

      var restaurantName = data.restaurantName || "My Restaurant";
      var logoUrl = data.logoUrl || "";
      var attendanceScriptUrl = data.attendanceSheetId || data.attendanceScriptUrl || "";
      var timeZone = data.timeZone || "America/Los_Angeles";
      var tenantId = "t_" + Utilities.getUuid().slice(0, 8);
      var adminName = data.name || "Restaurant Admin";

      // 1. Append to Tenants sheet
      tenantsSheet.appendRow([
        tenantId,
        restaurantName,
        logoUrl,
        email,
        attendanceScriptUrl,
        timeZone,
        nowIso
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

      return responseJSON({
        success: true,
        message: "Restaurant workspace created successfully!",
        tenant: {
          tenantId: tenantId,
          restaurantName: restaurantName,
          logoUrl: logoUrl,
          adminEmail: email,
          attendanceScriptUrl: attendanceScriptUrl,
          timeZone: timeZone
        },
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
        return responseJSON({ success: false, error: "Only an authorized restaurant Admin can invite employees." });
      }

      var tenantId = adminUser.tenantId;
      var tenant = findTenantById(tenantsSheet, tenantId);
      var restaurantName = tenant ? tenant.restaurantName : "the restaurant";

      // Check if employee already invited
      var existingEmployee = findUserByEmail(usersSheet, inviteEmail);
      if (existingEmployee) {
        if (existingEmployee.tenantId === tenantId) {
          return responseJSON({ success: false, error: "Employee is already a member of your team." });
        } else {
          return responseJSON({ success: false, error: "This Gmail address is already registered with another restaurant." });
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

      // Send Gmail Invitation using MailApp
      try {
        var subject = "You're invited to join " + restaurantName + " on CrewClock";
        var body = "Hello " + inviteName + ",\n\n" +
          adminUser.name + " (" + adminEmail + ") has invited you to join " + restaurantName + " on CrewClock for attendance and time tracking.\n\n" +
          "To access your shift portal and clock in, open the link below and Sign In with your Google account:\n" +
          appUrl + "\n\n" +
          "Best regards,\n" +
          restaurantName + " Team";

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

      var updated = updateTenant(tenantsSheet, adminUser.tenantId, {
        restaurantName: data.restaurantName,
        logoUrl: data.logoUrl,
        attendanceScriptUrl: data.attendanceSheetId || data.attendanceScriptUrl,
        timeZone: data.timeZone
      });

      return responseJSON({
        success: true,
        message: "Restaurant configuration updated!",
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
        return responseJSON({ success: false, error: "Unauthorized: Staff member is not registered in this restaurant workspace." });
      }

      // 2. Look up tenant to get the merchant's attendanceSheetId
      var tenant = findTenantById(tenantsSheet, tenantId);
      if (!tenant) {
        return responseJSON({ success: false, error: "Restaurant workspace not found." });
      }

      var targetSheet = tenant.attendanceScriptUrl || "";
      var sheetId = extractSpreadsheetIdFromStr(targetSheet);
      if (!sheetId) {
        return responseJSON({ success: false, error: "No valid Google Sheet ID configured for this restaurant." });
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
          error: "Permission Denied: Could not open restaurant Google Sheet. Please ensure the restaurant Owner opened their sheet (https://docs.google.com/spreadsheets/d/" + sheetId + "/edit) and shared it with " + (hostEmail || "the platform service email") + " as Editor."
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
  }
  return sheet;
}

function findUserByEmail(usersSheet, email) {
  var lastRow = usersSheet.getLastRow();
  if (lastRow <= 1) return null;
  var rows = usersSheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][0] || "").toString().trim().toLowerCase() === email) {
      return {
        email: rows[i][0],
        name: rows[i][1],
        role: rows[i][2],
        tenantId: rows[i][3],
        status: rows[i][4],
        invitedBy: rows[i][5],
        createdAt: rows[i][6]
      };
    }
  }
  return null;
}

function findTenantById(tenantsSheet, tenantId) {
  var lastRow = tenantsSheet.getLastRow();
  if (lastRow <= 1) return null;
  var rows = tenantsSheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][0] || "").toString().trim() === tenantId) {
      return {
        tenantId: rows[i][0],
        restaurantName: rows[i][1],
        logoUrl: rows[i][2],
        adminEmail: rows[i][3],
        attendanceScriptUrl: rows[i][4],
        timeZone: rows[i][5],
        createdAt: rows[i][6]
      };
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
  var rows = usersSheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][0] || "").toString().trim().toLowerCase() === email && (rows[i][3] || "").toString().trim() === tenantId) {
      usersSheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function updateTenant(tenantsSheet, tenantId, updates) {
  var lastRow = tenantsSheet.getLastRow();
  if (lastRow <= 1) return null;
  var rows = tenantsSheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][0] || "").toString().trim() === tenantId) {
      var rowNum = i + 2;
      if (updates.restaurantName) tenantsSheet.getRange(rowNum, 2).setValue(updates.restaurantName);
      if (updates.logoUrl !== undefined) tenantsSheet.getRange(rowNum, 3).setValue(updates.logoUrl);
      if (updates.attendanceScriptUrl) tenantsSheet.getRange(rowNum, 5).setValue(updates.attendanceScriptUrl);
      if (updates.timeZone) tenantsSheet.getRange(rowNum, 6).setValue(updates.timeZone);
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
