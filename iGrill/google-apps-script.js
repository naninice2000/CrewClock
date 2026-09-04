/**
 * Google Apps Script for Restaurant Employee Clock-In Web App
 * -------------------------------------------------------------
 * INSTRUCTIONS:
 * 1. Open your Google Sheet (create one at https://sheets.new).
 * 2. In the top menu, click Extensions > Apps Script.
 * 3. Delete any code in the editor and paste this entire script.
 * 4. Click "Deploy" (top right blue button) > "New deployment".
 * 5. Click the gear icon next to "Select type" and choose "Web app".
 * 6. Set Description: "Staff Clock-In Webhook".
 * 7. Set "Execute as": "Me (your email)".
 * 8. Set "Who has access": "Anyone" (allows the web app to submit clock-ins).
 * 9. Click "Deploy", authorize permissions, and copy the "Web app URL".
 * 10. Paste the Web app URL into config.js (or into Settings in the web app).
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

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
    var timestamp = data.timestamp || new Date().toLocaleString();

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

      // Append new Clock-In row
      sheet.appendRow([
        email,
        name,
        timestamp,
        locationStr,
        accuracy,
        mapsUrl,
        "",              // Col 7: Clock-Out Time (blank initially)
        "",              // Col 8: Duration (blank initially)
        "Clocked In"     // Col 9: Status
      ]);

      var newRowIndex = sheet.getLastRow();

      return responseJSON({
        success: true,
        action: "clockin",
        row: newRowIndex,
        email: email,
        timestamp: timestamp
      });

    // --- ACTION 2: CLOCK OUT (Same Row Update) ---
    } else if (action === "clockout") {
      var lastRow = sheet.getLastRow();
      var foundRow = -1;
      var clockInTimeStr = "";

      // Search from the bottom up for the employee's active shift
      if (lastRow > 1) {
        var dataRange = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
        for (var i = dataRange.length - 1; i >= 0; i--) {
          var rowEmail = (dataRange[i][0] || "").toString().trim().toLowerCase();
          var clockOutVal = dataRange[i][6]; // Col G: Clock-Out Time
          
          if (rowEmail === email && (!clockOutVal || clockOutVal.toString().trim() === "")) {
            foundRow = i + 2; // +2 for 1-based index and header row offset
            clockInTimeStr = dataRange[i][2]; // Col C: Clock-In Time
            break;
          }
        }
      }

      var durationStr = data.duration || "";
      if (!durationStr && foundRow !== -1) {
        try {
          var inTime = data.clockInIso ? new Date(data.clockInIso) : (clockInTimeStr instanceof Date ? clockInTimeStr : new Date(clockInTimeStr));
          var outTime = data.clockOutIso ? new Date(data.clockOutIso) : new Date();
          if (!isNaN(inTime) && !isNaN(outTime)) {
            var diffMs = Math.max(0, outTime - inTime);
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
          }
        } catch (err) {}
      }
      
      if (foundRow !== -1) {
        // Update Col 7 (Clock-Out Time), Col 8 (Duration), Col 9 (Status) in the EXACT same row
        sheet.getRange(foundRow, 7).setValue(timestamp);
        sheet.getRange(foundRow, 8).setValue(durationStr || "Recorded");
        sheet.getRange(foundRow, 9).setValue("Completed");

        return responseJSON({
          success: true,
          action: "clockout",
          row: foundRow,
          duration: durationStr,
          timestamp: timestamp
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
          timestamp,
          "N/A",
          "Completed"
        ]);
        return responseJSON({
          success: true,
          action: "clockout",
          warning: "No open clock-in found, recorded standalone clock-out."
        });
      }
    }

    return responseJSON({ success: false, error: "Unknown action" });

  } catch (error) {
    return responseJSON({ success: false, error: error.toString() });
  }
}

// Handle GET requests (connection ping test)
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    return responseJSON({
      success: true,
      message: "Google Apps Script Webhook is active and connected!",
      sheetName: sheet.getName(),
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
