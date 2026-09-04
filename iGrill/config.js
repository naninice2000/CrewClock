/**
 * Restaurant Employee Clock-In App Configuration
 * -------------------------------------------------------------
 * 1. googleClientId: Your Google Cloud Web Client ID (enables "Sign in with Google")
 * 2. googleScriptUrl: Your Google Apps Script Web App URL (from your Google Sheet)
 */

const APP_CONFIG = {
  // Your Restaurant or Business Name
  restaurantName: "iGrill Kebabs & Biryanis",

  // Optional: URL to your restaurant logo image
  restaurantLogo: "",

  // Google OAuth 2.0 Web Client ID (from Google Cloud Console)
  // e.g. "1234567890-abcdefg.apps.googleusercontent.com"
  googleClientId: "581219908499-6t51ebp75one50g1od070tvac8tslntl.apps.googleusercontent.com",

  // Google Apps Script Web App URL (from Google Sheet > Extensions > Apps Script > Deploy)
  // e.g. "https://script.google.com/macros/s/AKfycbx.../exec"
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbzzGVPRyNFusb6xyVm2TnCgiNTSm9xPM1kKz8cUjAyZTUnpWHDVe1nmJxFobSGCksPT/exec"
};
