/**
 * Google Apps Script for Restaurant Employee Clock-In Web App
 * -------------------------------------------------------------
 * INSTRUCTIONS:
 * 1. Open your Google Sheet (create one at https://sheets.new).
 * 2. Set your restaurant's time zone: File > Settings > Time zone.
 * 3. In the top menu, click Extensions > Apps Script.
 * 4. Delete any code in the editor and paste this entire script.
 * 5. Click "Deploy" (top right blue button) > "New deployment" (or "Manage deployments" > Edit > New version if updating).
 * 6. Click the gear icon next to "Select type" and choose "Web app".
 * 7. Set Description: "Staff Clock-In Webhook (Server Time)".
 * 8. Set "Execute as": "Me (your email)".
 * 9. Set "Who has access": "Anyone" (allows the web app to submit clock-ins).
 * 10. Click "Deploy", authorize permissions, and copy the "Web app URL".
 * 11. Paste the Web app URL into config.js (or into Settings in the web app).
 */

function doPost(e) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getActiveSheet();
    var timeZone = spreadsheet.getSpreadsheetTimeZone() || "America/Los_Angeles";

    // Automatically create and format headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Email",
        "Employee Name",
        "Clock-In Time",
        "Location (Lat, Lng)",
        "Accuracy",
        "Google Maps Link",
        "Clock-Out Time",
        "Shift Duration",
        "Status"
      ]);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#F1F5F9");
      sheet.setFrozenRows(1);
    }

    // Parse incoming JSON payload
    var data = {};
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter;
      }
    } else {
      data = e.parameter;
    }

    var action = data.action || "clockin";
    var email = (data.email || "").trim().toLowerCase();
    var name = data.name || "Staff Member";

    // Official Server Timestamp (tamper-proof, locked to spreadsheet timezone)
    var serverNow = new Date();
    var serverTimestampStr = Utilities.formatDate(serverNow, timeZone, "MMM dd, yyyy hh:mm:ss a");
    var serverIso = serverNow.toISOString();

    if (!email) {
      return responseJSON({ success: false, error: "Email is required" });
    }

    // --- ACTION 1: CLOCK IN ---
    if (action === "clockin") {
      var lat = data.latitude || "";
      var lng = data.longitude || "";
      var accuracy = data.accuracy ? (Math.round(data.accuracy) + " m") : "N/A";
      var locationStr = (lat && lng) ? (lat + ", " + lng) : "Location Unavailable";
      var mapsUrl = (lat && lng) ? ("https://www.google.com/maps?q=" + lat + "," + lng) : "";

      // Append new Clock-In row with official Google Server Time
      sheet.appendRow([
        email,
        name,
        serverTimestampStr, // Col 3: Official Server Clock-In Time
        locationStr,
        accuracy,
        mapsUrl,
        "",                 // Col 7: Clock-Out Time (blank initially)
        "",                 // Col 8: Duration (blank initially)
        "Clocked In"        // Col 9: Status
      ]);

      var newRowIndex = sheet.getLastRow();

      return responseJSON({
        success: true,
        action: "clockin",
        row: newRowIndex,
        email: email,
        timestamp: serverTimestampStr,
        serverIso: serverIso,
        timeZone: timeZone
      });

    // --- ACTION 2: CLOCK OUT (Same Row Update) ---
    } else if (action === "clockout") {
      var lastRow = sheet.getLastRow();
      var foundRow = -1;
      var clockInVal = "";

      // Search from the bottom up for the employee's active shift
      if (lastRow > 1) {
        var dataRange = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
        for (var i = dataRange.length - 1; i >= 0; i--) {
          var rowEmail = (dataRange[i][0] || "").toString().trim().toLowerCase();
          var clockOutVal = dataRange[i][6]; // Col G: Clock-Out Time
          
          if (rowEmail === email && (!clockOutVal || clockOutVal.toString().trim() === "")) {
            foundRow = i + 2; // +2 for 1-based index and header row offset
            clockInVal = dataRange[i][2]; // Col C: Clock-In Time
            break;
          }
        }
      }

      // Compute shift duration on Google's servers (tamper-proof)
      var durationStr = "";
      var inTime = null;
      if (clockInVal instanceof Date) {
        inTime = clockInVal;
      } else if (clockInVal && clockInVal.toString().trim() !== "") {
        inTime = new Date(clockInVal);
      }

      // Fallback to client ISO timestamp if cell date parsing fails
      if ((!inTime || isNaN(inTime.getTime())) && data.clockInIso) {
        inTime = new Date(data.clockInIso);
      }

      if (inTime && !isNaN(inTime.getTime())) {
        var diffMs = Math.max(0, serverNow.getTime() - inTime.getTime());
        var totalSecs = Math.floor(diffMs / 1000);
        var hours = Math.floor(totalSecs / 3600);
        var mins = Math.floor((totalSecs % 3600) / 60);
        var secs = totalSecs % 60;
        if (hours > 0) {
          durationStr = hours + "h " + mins + "m";
        } else if (mins > 0) {
          durationStr = mins + "m " + secs + "s";
        } else {
          durationStr = secs + "s";
        }
      } else {
        durationStr = data.duration || "Recorded";
      }
      
      if (foundRow !== -1) {
        // Update Col 7 (Clock-Out Time), Col 8 (Duration), Col 9 (Status) in the EXACT same row
        sheet.getRange(foundRow, 7).setValue(serverTimestampStr);
        sheet.getRange(foundRow, 8).setValue(durationStr);
        sheet.getRange(foundRow, 9).setValue("Completed");

        return responseJSON({
          success: true,
          action: "clockout",
          row: foundRow,
          duration: durationStr,
          timestamp: serverTimestampStr,
          serverIso: serverIso,
          timeZone: timeZone
        });
      } else {
        // If no unclosed shift row found, append a standalone clock-out row
        sheet.appendRow([
          email,
          name,
          "No previous clock-in",
          "N/A",
          "N/A",
          "",
          serverTimestampStr,
          "N/A",
          "Completed"
        ]);
        return responseJSON({
          success: true,
          action: "clockout",
          timestamp: serverTimestampStr,
          serverIso: serverIso,
          warning: "No open clock-in found, recorded standalone clock-out."
        });
      }
    }

    return responseJSON({ success: false, error: "Unknown action" });

  } catch (error) {
    return responseJSON({ success: false, error: error.toString() });
  }
}

// Handle GET requests (connection ping test & server time synchronization)
function doGet(e) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getActiveSheet();
    var timeZone = spreadsheet.getSpreadsheetTimeZone() || "America/Los_Angeles";
    var serverNow = new Date();
    var serverTimestampStr = Utilities.formatDate(serverNow, timeZone, "MMM dd, yyyy hh:mm:ss a");

    return responseJSON({
      success: true,
      message: "Google Apps Script Webhook is active and connected!",
      sheetName: sheet.getName(),
      timeZone: timeZone,
      serverTimeIso: serverNow.toISOString(),
      serverTimestamp: serverTimestampStr,
      totalRows: Math.max(0, sheet.getLastRow() - 1)
    });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
