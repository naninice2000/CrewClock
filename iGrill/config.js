/**
 * Small & Medium Business Employee Clock-In App Configuration (Multi-Tenant Enabled)
 * ---------------------------------------------------------------------
 * 1. googleClientId: Google OAuth 2.0 Web Client ID
 * 2. tenancyScriptUrl: Central Google Apps Script URL for Tenants & Users Sheet
 * 3. googleScriptUrl: Default Attendance Sheet Google Apps Script URL
 */

const APP_CONFIG = {
  // Central Multi-Tenancy & User Directory Google Apps Script URL
  // Deploy google-apps-script-tenancy.js to your "Tenants & Users" Google Sheet and paste URL here:
  tenancyScriptUrl: "https://script.google.com/macros/s/AKfycbyHlJpM1Xf_zHVKL4VS8jJXy-0vFpMbdwvcNsEH5ljNuQZVxTjzoO_sZdgci-W0EV-K/exec",

  // Google OAuth 2.0 Web Client ID (from Google Cloud Console)
  googleClientId: "581219908499-6t51ebp75one50g1od070tvac8tslntl.apps.googleusercontent.com",

  // Platform Organization Name (Multi-Tenant Umbrella Entity)
  organizationName: "Lightning Ventures LLC",
  businessName: "Lightning Ventures LLC",
  restaurantName: "Lightning Ventures LLC",

  // Optional: URL to platform/organization logo image
  organizationLogo: "",
  businessLogo: "",
  restaurantLogo: "",

  // Default Attendance Google Apps Script Web App URL (from your Attendance Google Sheet)
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbxWH25K2PA2X2xDDTYvz28cnq09NslsGVgPBT1-SCJ0ID_wjzoP1BS_3QhNAYI8Psk-/exec",

  // Optional: Decoupled High-Throughput Buffer Microservice URL (e.g. Firebase / Cloud Run)
  // When provided, punches are buffered and micro-batched; if empty, defaults to direct Apps Script
  bufferEndpointUrl: ""
};
