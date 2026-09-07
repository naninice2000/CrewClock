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
 * 7. Set Description: "Staff Clock-In Webhook (Server Time & Dual Location)".
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

    // 1. Ensure Header Row exists
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Email",
        "Employee Name",
        "Clock-In Time",
        "Clock-In Location",
        "Clock-In Accuracy",
        "Clock-In Maps Link",
        "Clock-Out Time",
        "Clock-Out Location",
        "Clock-Out Maps Link",
        "Shift Duration",
        "Status"
      ]);
      sheet.getRange(1, 1, 1, 11).setFontWeight("bold").setBackground("#F1F5F9");
      sheet.setFrozenRows(1);
    }

    // 2. Parse incoming payload
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

    var action = (data.action || "clockin").toLowerCase();
    var email = (data.email || "").trim().toLowerCase();
    var name = data.name || "Staff Member";

    // Official Server Timestamp (tamper-proof, locked to spreadsheet timezone)
    var serverNow = new Date();
    var serverTimestampStr = Utilities.formatDate(serverNow, timeZone, "MMM dd, yyyy hh:mm:ss a");
    var serverIso = serverNow.toISOString();

    if (!email) {
      return responseJSON({ success: false, error: "Email is required" });
    }

    // Read existing headers to dynamically map columns
    var lastCol = Math.max(1, sheet.getLastColumn());
    var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = mapHeaders(headerRow, sheet);

    // --- ACTION 1: CLOCK IN ---
    if (action === "clockin") {
      var lat = data.latitude || "";
      var lng = data.longitude || "";
      var accuracy = data.accuracy ? (Math.round(data.accuracy) + " m") : "N/A";
      var locationStr = (lat && lng) ? (lat + ", " + lng) : "Location Unavailable";
      var mapsUrl = (lat && lng) ? ("https://www.google.com/maps?q=" + lat + "," + lng) : "";

      // Build row according to header mapping
      var rowData = new Array(sheet.getLastColumn()).fill("");
      rowData[colMap.email - 1] = email;
      rowData[colMap.name - 1] = name;
      rowData[colMap.clockInTime - 1] = serverTimestampStr;
      rowData[colMap.clockInLoc - 1] = locationStr;
      if (colMap.clockInAcc !== -1) rowData[colMap.clockInAcc - 1] = accuracy;
      if (colMap.clockInMap !== -1) rowData[colMap.clockInMap - 1] = mapsUrl;
      rowData[colMap.status - 1] = "Clocked In";

      sheet.appendRow(rowData);
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

    // --- ACTION 2: CLOCK OUT (Update same row with clock-out time & location) ---
    } else if (action === "clockout") {
      var lastRow = sheet.getLastRow();
      var foundRow = -1;
      var clockInVal = "";

      // Search from the bottom up for employee's active shift
      if (lastRow > 1) {
        var emailColIdx = colMap.email;
        var clockOutColIdx = colMap.clockOutTime;
        var clockInColIdx = colMap.clockInTime;

        var emailValues = sheet.getRange(2, emailColIdx, lastRow - 1, 1).getValues();
        var clockOutValues = sheet.getRange(2, clockOutColIdx, lastRow - 1, 1).getValues();
        var clockInValues = sheet.getRange(2, clockInColIdx, lastRow - 1, 1).getValues();

        for (var i = emailValues.length - 1; i >= 0; i--) {
          var rowEmail = (emailValues[i][0] || "").toString().trim().toLowerCase();
          var clockOutVal = clockOutValues[i][0];

          if (rowEmail === email && (!clockOutVal || clockOutVal.toString().trim() === "")) {
            foundRow = i + 2; // +2 for 1-based index and header offset
            clockInVal = clockInValues[i][0];
            break;
          }
        }
      }

      // Compute shift duration on Google's servers
      var durationStr = "";
      var inTime = null;
      if (clockInVal instanceof Date) {
        inTime = clockInVal;
      } else if (clockInVal && clockInVal.toString().trim() !== "") {
        inTime = new Date(clockInVal);
      }
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

      // Parse clock-out location
      var outLat = data.latitude || "";
      var outLng = data.longitude || "";
      var outLocationStr = (outLat && outLng) ? (outLat + ", " + outLng) : "Location Unavailable";
      var outMapsUrl = (outLat && outLng) ? ("https://www.google.com/maps?q=" + outLat + "," + outLng) : "";

      if (foundRow !== -1) {
        // Update Clock-Out Time, Duration, Status
        sheet.getRange(foundRow, colMap.clockOutTime).setValue(serverTimestampStr);
        if (colMap.duration !== -1) sheet.getRange(foundRow, colMap.duration).setValue(durationStr);
        sheet.getRange(foundRow, colMap.status).setValue("Completed");

        // Update Clock-Out Location & Map Link
        if (colMap.clockOutLoc !== -1) {
          sheet.getRange(foundRow, colMap.clockOutLoc).setValue(outLocationStr);
        }
        if (colMap.clockOutMap !== -1 && outMapsUrl) {
          sheet.getRange(foundRow, colMap.clockOutMap).setValue(outMapsUrl);
        }

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
        // Fallback: append standalone clock-out row
        var rowData = new Array(sheet.getLastColumn()).fill("");
        rowData[colMap.email - 1] = email;
        rowData[colMap.name - 1] = name;
        rowData[colMap.clockInTime - 1] = "No previous clock-in";
        rowData[colMap.clockOutTime - 1] = serverTimestampStr;
        if (colMap.clockOutLoc !== -1) rowData[colMap.clockOutLoc - 1] = outLocationStr;
        if (colMap.clockOutMap !== -1) rowData[colMap.clockOutMap - 1] = outMapsUrl;
        if (colMap.duration !== -1) rowData[colMap.duration - 1] = "N/A";
        rowData[colMap.status - 1] = "Completed";

        sheet.appendRow(rowData);
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

// Map column positions from existing header row, adding clock-out location columns if needed
function mapHeaders(headerRow, sheet) {
  var findIdx = function(keywords) {
    for (var i = 0; i < headerRow.length; i++) {
      var h = (headerRow[i] || "").toString().trim().toLowerCase();
      for (var k = 0; k < keywords.length; k++) {
        if (h.indexOf(keywords[k].toLowerCase()) !== -1) return i + 1;
      }
    }
    return -1;
  };

  var map = {
    email: findIdx(["email"]),
    name: findIdx(["employee name", "name"]),
    clockInTime: findIdx(["clock-in time", "clock in time", "clock in"]),
    clockInLoc: findIdx(["clock-in location", "location (lat, lng)", "location"]),
    clockInAcc: findIdx(["clock-in accuracy", "accuracy"]),
    clockInMap: findIdx(["clock-in map", "google maps link", "maps link"]),
    clockOutTime: findIdx(["clock-out time", "clock out time", "clock out"]),
    clockOutLoc: findIdx(["clock-out location", "clock out location"]),
    clockOutMap: findIdx(["clock-out map", "clock out map"]),
    duration: findIdx(["shift duration", "duration"]),
    status: findIdx(["status"])
  };

  // Defaults if headers were missing
  if (map.email === -1) map.email = 1;
  if (map.name === -1) map.name = 2;
  if (map.clockInTime === -1) map.clockInTime = 3;
  if (map.clockInLoc === -1) map.clockInLoc = 4;
  if (map.clockOutTime === -1) map.clockOutTime = 7;
  if (map.status === -1) map.status = 9;

  // Auto-upgrade legacy 9-column sheet by appending Clock-Out Location headers to row 1
  if (map.clockOutLoc === -1) {
    var newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue("Clock-Out Location").setFontWeight("bold").setBackground("#F1F5F9");
    map.clockOutLoc = newCol;
  }
  if (map.clockOutMap === -1) {
    var newCol2 = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol2).setValue("Clock-Out Maps Link").setFontWeight("bold").setBackground("#F1F5F9");
    map.clockOutMap = newCol2;
  }

  return map;
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
