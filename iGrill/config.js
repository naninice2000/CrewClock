/**
 * Restaurant Employee Clock-In App Configuration (Multi-Tenant Enabled)
 * ---------------------------------------------------------------------
 * 1. googleClientId: Google OAuth 2.0 Web Client ID
 * 2. tenancyScriptUrl: Central Google Apps Script URL for Tenants & Users Sheet
 * 3. googleScriptUrl: Default Attendance Sheet Google Apps Script URL
 */

const APP_CONFIG = {
  // Central Multi-Tenancy & User Directory Google Apps Script URL
  // Deploy google-apps-script-tenancy.js to your "Tenants & Users" Google Sheet and paste URL here:
  tenancyScriptUrl: "",

  // Google OAuth 2.0 Web Client ID (from Google Cloud Console)
  googleClientId: "581219908499-6t51ebp75one50g1od070tvac8tslntl.apps.googleusercontent.com",

  // Default Restaurant / Brand Name
  restaurantName: "iGrill Kebabs & Biryanis",

  // Optional: URL to restaurant logo image
  restaurantLogo: "",

  // Default Attendance Google Apps Script Web App URL (from your Attendance Google Sheet)
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbxWH25K2PA2X2xDDTYvz28cnq09NslsGVgPBT1-SCJ0ID_wjzoP1BS_3QhNAYI8Psk-/exec"
};
