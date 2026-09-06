# CrewClock: Multi-Tenant Attendance & Time Clock Platform
> **Comprehensive Architecture, Security, Platform Setup & Merchant Onboarding Guide**

Welcome to the **CrewClock** project documentation. CrewClock is a serverless, multi-tenant employee time-tracking and attendance system designed for single and multi-unit restaurants, hospitality venues, and shift-based businesses.

It runs **100% client-side** on **GitHub Pages**, backed by **Google Identity Services (OAuth 2.0)** for genuine Gmail verification and **Google Apps Script Webhooks** for automated, tamper-proof logging into **Google Sheets**.

---

## Table of Contents

1. [System Overview & Key Features](#1-system-overview--key-features)
2. [Architecture & System Design](#2-architecture--system-design)
   - [High-Level Architecture](#high-level-architecture)
   - [Dual-Sheet Isolation Model](#dual-sheet-isolation-model)
   - [Tamper-Proof Server Time Synchronization](#tamper-proof-server-time-synchronization)
   - [Dual-Location Geolocation Auditing](#dual-location-geolocation-auditing)
   - [Hybrid Mobile Wrappers (iOS & Android)](#hybrid-mobile-wrappers-ios--android)
3. [Role-Based Access Control (RBAC) & Security](#3-role-based-access-control-rbac--security)
   - [Roles & Permissions Matrix](#roles--permissions-matrix)
   - [Invitation-Only Access Enforcement](#invitation-only-access-enforcement)
   - [7-Day Persistent Session Protocol](#7-day-persistent-session-protocol)
4. [Platform Administrator Setup Guide](#4-platform-administrator-setup-guide)
   - [Step 1: Deploy Central Multi-Tenant Directory Sheet](#step-1-deploy-central-multi-tenant-directory-sheet)
   - [Step 2: Configure Google Cloud OAuth 2.0 Credentials](#step-2-configure-google-cloud-oauth-20-credentials)
   - [Step 3: Deploy Frontend to GitHub Pages](#step-3-deploy-frontend-to-github-pages)
5. [Merchant (Restaurant Owner) Getting Started Guide](#5-merchant-restaurant-owner-getting-started-guide)
   - [3-Minute Fast-Track Setup Checklist](#3-minute-fast-track-setup-checklist)
   - [Step 1: Create & Secure Your Google Sheet](#step-1-create--secure-your-google-sheet)
   - [Step 2: Sign Up Your Restaurant Workspace](#step-2-sign-up-your-restaurant-workspace)
   - [Step 3: Complete Workspace Onboarding Form](#step-3-complete-workspace-onboarding-form)
   - [Step 4: Invite Employees to Your Restaurant Team](#step-4-invite-employees-to-your-restaurant-team)
   - [Step 5: Managing the Team Roster & Offboarding](#step-5-managing-the-team-roster--offboarding)
   - [Step 6: Real-Time Attendance Auditing & Payroll Export](#step-6-real-time-attendance-auditing--payroll-export)
   - [Merchant Admin Troubleshooting & FAQs](#merchant-admin-troubleshooting--faqs)
6. [Employee User Guide](#6-employee-user-guide)
   - [Accepting Your Invitation](#accepting-your-invitation)
   - [One-Time Google Sign-In](#one-time-google-sign-in)
   - [Clocking In for a Shift](#clocking-in-for-a-shift)
   - [During Shift & Active Timer](#during-shift--active-timer)
   - [Clocking Out & Shift Summary](#clocking-out--shift-summary)
   - [Reviewing Shift History](#reviewing-shift-history)
7. [Native Mobile Apps Guide](#7-native-mobile-apps-guide)
   - [iOS Native Wrapper (WKWebView)](#ios-native-wrapper-wkwebview)
   - [Android Native Wrapper (WebView)](#android-native-wrapper-webview)
   - [Zero-Rebuild Auto-Update Architecture](#zero-rebuild-auto-update-architecture)
8. [Spreadsheet Schemas Reference](#8-spreadsheet-schemas-reference)
9. [Troubleshooting & FAQs](#9-troubleshooting--faqs)

---

## 1. System Overview & Key Features

* **Multi-Tenancy**: Multiple distinct restaurant brands and locations can use the exact same web app or mobile app instance while maintaining total data isolation.
* **Serverless & Zero Hosting Costs**: Runs entirely on GitHub Pages with Google Sheets as the database. Zero servers, databases, or monthly software subscriptions.
* **Dual-Location GPS Verification**: Captures hardware GPS coordinates and Google Maps links at the exact moment of **both** Clock-In and Clock-Out.
* **Tamper-Proof Time Tracking**: Clocks and durations are synchronized with authoritative Google Cloud server time in the restaurant's configured timezone, preventing device clock tampering.
* **Role-Based Access Control (RBAC)**:
  * **Admins**: Manage branding, team invitations, staff removals, and attendance sheet routing.
  * **Staff Members**: Clean, distraction-free interface containing only Clock-In / Clock-Out and personal shift logs. No access to settings or employee rosters.
* **Automated Email Invitations**: Admins invite employees by Gmail; Google Apps Script automatically dispatches branded welcome invitations via `MailApp`.
* **Cross-Platform Access**: Usable directly in mobile web browsers (Safari, Chrome) or inside dedicated iOS and Android native apps.

---

## 2. Architecture & System Design

### High-Level Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │           CrewClock Web Portal               │
                               │      (Hosted on GitHub Pages / CDN)          │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                 Google OAuth 2.0 GIS │ Verification
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │         Google Identity Services             │
                               │   • Authenticates genuine Gmail user         │
                               │   • Returns email, name, avatar              │
                               └──────────────────────┬───────────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       │                                                             │
                       ▼                                                             ▼
         [If Action = Signup / Check User]                             [If Action = Clock-In / Clock-Out]
                       │                                                             │
                       ▼                                                             ▼
┌──────────────────────────────────────────────┐              ┌──────────────────────────────────────────────┐
│       Central Multi-Tenant Directory         │              │     Restaurant Attendance Spreadsheet        │
│       Google Apps Script: tenancy.js         │              │        Google Apps Script: webhook.js        │
│  • Validates tenant membership & roles       │              │  • Enforces Google Cloud Server Time         │
│  • Provisions new restaurant tenants         │              │  • Logs Clock-In GPS & Accuracy              │
│  • Dispatches MailApp Gmail invitations      │              │  • Computes Duration & Logs Clock-Out GPS    │
└──────────────────────┬───────────────────────┘              └──────────────────────┬───────────────────────┘
                       │                                                             │
                       ▼                                                             ▼
┌──────────────────────────────────────────────┐              ┌──────────────────────────────────────────────┐
│  Spreadsheet: Tenants & Users Directory      │              │  Spreadsheet: [Restaurant] Attendance Sheet  │
│  • Sheet 1: Tenants (ID, Name, Logo, URL)    │              │  • Row per Shift (Dual Location GPS, Times,  │
│  • Sheet 2: Users (Email, Role, Tenant ID)   │              │    Duration, Status)                         │
└──────────────────────────────────────────────┘              └──────────────────────────────────────────────┘
```

### Dual-Sheet Isolation Model

CrewClock strictly separates **Tenant Identity/Access Management** from **Operational Attendance Data**:

1. **Central Tenants & Users Directory (`google-apps-script-tenancy.js`)**:
   * Owned and controlled by the platform operator.
   * Maintains master records of all registered restaurant workspaces (`Tenants`) and active employee affiliations (`Users`).
   * When an employee logs in, this service looks up their Gmail, determines their role (`admin` vs `employee`), and resolves their assigned restaurant's private attendance sheet webhook.
2. **Individual Restaurant Attendance Sheet (`google-apps-script.js`)**:
   * Created and owned directly by the restaurant merchant inside their personal Google Drive.
   * Completely isolated: Restaurant A can never view, query, or affect the attendance data of Restaurant B.
   * Employees do not need Google Drive or Sheets edit access. The Apps Script Webhook runs under the owner's credentials (`Execute as: Me`) to append and update records safely.

### Tamper-Proof Server Time Synchronization

To eliminate employee device clock manipulation (e.g., changing local phone settings forward or backward):
1. Upon loading the app, the client performs a high-precision `GET` ping to the Google Apps Script Webhook.
2. The Google server returns its authoritative `ISO 8601` timestamp alongside the restaurant's configured IANA timezone (e.g., `America/Los_Angeles`).
3. The client measures network latency round-trip time (`RTT`) and establishes a clock offset:
   $$\text{Offset} = (\text{ServerTime} + \frac{\text{RTT}}{2}) - \text{ClientTime}$$
4. All subsequent timestamps and durations are locked to this synchronized server time.

### Dual-Location Geolocation Auditing

CrewClock uses the HTML5 Geolocation API configured for maximum precision (`enableHighAccuracy: true`, `timeout: 15000`, `maximumAge: 0`):
* **At Clock-In**: Device hardware GPS latitude, longitude, and accuracy radius ($\pm\text{meters}$) are captured at the exact second the button is pressed.
* **At Clock-Out**: GPS coordinates are re-acquired independently.
* Both locations are translated into clickable Google Maps links directly in the spreadsheet row (`https://maps.google.com/?q=lat,lng`), providing complete auditing against off-site clock-ins.

### Hybrid Mobile Wrappers (iOS & Android)

CrewClock includes production-ready native mobile shells for iOS (Swift / `WKWebView`) and Android (Kotlin / `WebView`):
* Loads directly from GitHub Pages (`https://<username>.github.io/CrewClock/iGrill/`).
* Pre-configured with native Geolocation permission handlers (`NSLocationWhenInUseUsageDescription` in iOS, `ACCESS_FINE_LOCATION` in Android).
* **Zero-Rebuild Deployment**: Any design or feature updates deployed to the GitHub Pages web app are immediately reflected in all installed mobile apps without requiring App Store or Google Play Store re-submission.

---

## 3. Role-Based Access Control (RBAC) & Security

### Roles & Permissions Matrix

| Capability | Platform Admin | Restaurant Admin (`admin`) | Employee (`employee`) | Uninvited User |
| :--- | :---: | :---: | :---: | :---: |
| Sign In with Google | ✅ | ✅ | ✅ | ❌ *(Blocked)* |
| Sign Up New Restaurant Workspace | ✅ | ✅ | ❌ *(Hidden)* | ❌ *(Blocked)* |
| Clock-In & Clock-Out | ✅ | ✅ | ✅ | ❌ |
| View Personal Shift Log | ✅ | ✅ | ✅ | ❌ |
| Manage Team & Send Gmail Invites | ✅ | ✅ | ❌ *(Hidden)* | ❌ |
| Remove Staff from Team | ✅ | ✅ | ❌ *(Hidden)* | ❌ |
| Configure Restaurant Branding & Sheet URLs | ✅ | ✅ | ❌ *(Hidden)* | ❌ |
| Access Central Tenants Directory Sheet | ✅ | ❌ | ❌ | ❌ |
| Access Own Restaurant Attendance Sheet | ✅ | ✅ | ❌ *(Webhook Only)* | ❌ |

### Invitation-Only Access Enforcement

To prevent arbitrary Google users from entering a restaurant workspace:
1. When a user authenticates through Google Identity Services, their verified Gmail is passed to the Directory Webhook (`action: "check_user"`).
2. If the email is not registered in the `Users` sheet:
   * The app denies entry and halts authentication.
   * Displays the **"Access Restricted"** banner:
     > *"Account 'name@gmail.com' is not registered in any restaurant workspace. Please ask your manager to invite this Gmail, or sign up as a restaurant owner below."*
3. Only emails invited by an active Restaurant Admin or registered during Admin Signup are permitted.

### 7-Day Persistent Session Protocol

To deliver a native time-clock experience without tedious re-login prompts:
* Authenticated sessions are securely stored in browser `localStorage` with a 7-day TTL (`expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000`).
* When an employee clocks out, their **active shift resets**, but their **user session remains intact**. When they return the next day, they are immediately greeted on Screen 1 ready to Clock In.
* Upon TTL expiry, the app smoothly transitions back to Screen 0 with a notice: *"Your session has expired. Please sign in with Google to continue."*

---

## 4. Platform Administrator Setup Guide

This guide is for the **Platform Owner** deploying the central CrewClock service.

### Step 1: Deploy Central Multi-Tenant Directory Sheet

1. Open [Google Sheets](https://sheets.new) and create a new spreadsheet.
2. Name it: **`CrewClock - Tenants & Users Directory`**.
3. Navigate to **Extensions > Apps Script**.
4. Clear any existing code in the editor and paste the entire content of [`google-apps-script-tenancy.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/iGrill/google-apps-script-tenancy.js).
5. Click **Deploy > New deployment**:
   * Click the **Gear icon** next to *Select type* and select **Web app**.
   * **Description**: `CrewClock Central Directory & RBAC`
   * **Execute as**: `Me (your Google email)`
   * **Who has access**: `Anyone` *(required for client web app queries)*
6. Click **Deploy**, grant permissions during the OAuth authorization screen, and copy the **Web app URL** (`https://script.google.com/macros/s/.../exec`).

### Step 2: Configure Google Cloud OAuth 2.0 Credentials & Enable Sheets API

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `CrewClock-Portal`.
3. In the left navigation, go to **APIs & Services > Library**:
   * Search for **Google Sheets API** and click **Enable**.
4. In the left navigation, go to **APIs & Services > OAuth consent screen**:
   * Choose **External** and click **Create**.
   * **App name**: `CrewClock Attendance Portal`
   * **User support email**: Your email.
   * **Authorized domains**: `github.io` (and `localhost` for local dev).
   * **Scopes**: Select `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `https://www.googleapis.com/auth/spreadsheets`.
5. Navigate to **APIs & Services > Credentials**:
   * Click **Create Credentials > OAuth client ID**.
   * Application type: **Web application**.
   * **Authorized JavaScript origins**:
     * `http://localhost:8000` *(for local development)*
     * `https://<your-github-username>.github.io` *(for GitHub Pages)*
   * Click **Create** and copy your **Client ID** (ends with `.apps.googleusercontent.com`).

### Step 3: Deploy Frontend to GitHub Pages

1. In your repository, open [`iGrill/config.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/iGrill/config.js) and populate your credentials:
   ```javascript
   const APP_CONFIG = {
     // Central Directory Web App URL from Step 1
     tenancyScriptUrl: "https://script.google.com/macros/s/AKfycb.../exec",

     // Google OAuth 2.0 Client ID from Step 2
     googleClientId: "123456789-xxxx.apps.googleusercontent.com",

     // Default fallback brand name
     restaurantName: "CrewClock Hospitality",

     // Default fallback attendance sheet (optional)
     googleScriptUrl: ""
   };
   ```
2. Commit and push the repository to GitHub:
   ```bash
   git add .
   git commit -m "Deploy CrewClock multi-tenant platform"
   git push origin main
   ```
3. In your GitHub repository, open **Settings > Pages**:
   * Source: **Deploy from a branch**.
   * Branch: `main`, folder: `/(root)`.
   * Click **Save**.
4. Your platform is now live at: `https://<username>.github.io/CrewClock/iGrill/`

---

## 5. Merchant (Restaurant Owner) Getting Started Guide

Follow this guide if you are a **restaurant owner, general manager, or franchisee** setting up CrewClock for your location. As a Merchant Admin, you have full ownership over your restaurant's branding, team roster, and attendance records.

> [!TIP]
> **Data Sovereignty & Privacy**: You do **not** need to install database servers, pay monthly software subscriptions, or grant external third parties access to your payroll data. Your employee attendance logs live directly in your personal Google Drive account.

---

### 3-Minute Fast-Track Setup Checklist

Here is everything you need to launch CrewClock for your restaurant in under 3 minutes:

- [ ] **1. Create Attendance Sheet**: Open [Google Sheets](https://sheets.new) and create a new blank spreadsheet.
- [ ] **2. Set Timezone**: Go to **File > Settings** and pick your restaurant's local time zone.
- [ ] **3. Share as Editor**: Share your sheet with the CrewClock Platform Service Email as **Editor** (keep staff access at **0%**).
- [ ] **4. Copy Link**: Copy your sheet URL or Sheet ID from your browser address bar.
- [ ] **5. Sign Up Restaurant**: Visit the CrewClock portal and click **"Sign Up Your Restaurant with Google"**.
- [ ] **6. Fill Onboarding Form**: Enter your restaurant name, paste your Sheet URL/ID, and click **Create Workspace & Start**.
- [ ] **7. Invite Staff**: Click **Team Management (👥)** and enter your employees' Gmail addresses.

---

### Step 1: Create & Secure Your Google Sheet

Merchants have two flexible options for their attendance sheet:

#### 🏆 Choice A (Recommended): Tamper-Proof Google Sheet ID
Every restaurant owner keeps 100% control and ownership over their employee attendance data in their personal Google Drive without writing or deploying any code. Employees have **zero access to the sheet**, making it impossible for staff to view, alter, or tamper with their hours.

1. Open [Google Sheets](https://sheets.new) in your desktop or mobile browser.
2. Name the sheet: **`[Your Restaurant Name] - Staff Attendance`** (e.g., `Bella Bistro - Staff Attendance`).
3. **Set your restaurant's operational time zone**:
   * Click **File > Settings** in the top menu.
   * Under **Calculation / Time zone**, select your city or time zone (e.g., `(GMT-08:00) Pacific Time - Los Angeles`).
   * Click **Save and reload**.

4. **Locate your Google Sheet ID or URL**:
   Look at your browser's address bar. The URL follows this standard format:
   ```text
   https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
                                          ▲──────────────────────────────────────────▲
                                                     Google Sheet ID
   ```
   * You can copy and paste either the **entire browser URL** OR just the **Sheet ID** string between `/d/` and `/edit`. CrewClock automatically detects and extracts the ID!

5. **Share with the Platform Service Email**:
   * Click the green **Share** button in the top-right corner of Google Sheets.
   * Enter the **Platform Service Email** displayed in your CrewClock setup dialog (e.g., `platform-service@your-crewclock-domain.com` or the central admin's email).
   * Set the dropdown role to: **Editor**.
   * *(Optional)* Uncheck "Notify people" to skip sending a notification email.
   * Click **Share**.

> [!IMPORTANT]
> **Strict Anti-Tampering Rule: DO NOT share this sheet with your employees!**
>
> If employees are granted view or edit access to the spreadsheet directly in Google Drive, they could manually edit clock-in timestamps, delete rows, or view colleagues' hours.
>
> With CrewClock's architecture, **only the platform service email needs Editor access**. When an employee clocks in or out via the app, CrewClock verifies their identity via Google OAuth, captures hardware GPS coordinates, synchronizes authoritative Google Cloud server time, and securely appends the verified shift row into your sheet. Employees have **zero access** to the underlying file, guaranteeing 100% tamper-proof records.

> [!NOTE]
> You do **not** need to manually format columns or headers! CrewClock will automatically initialize the `Attendance` tab with all 11 required audit headers on the very first clock-in.

#### ⚙️ Choice B (Optional): Custom Google Apps Script Webhook
If you have custom IT requirements and prefer running an independent Google Apps Script Webhook endpoint under your own Google account:
1. In your Google Sheet, click **Extensions > Apps Script**.
2. Delete any boilerplate code and paste the complete contents of [`google-apps-script.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/iGrill/google-apps-script.js).
3. Click **Deploy > New deployment**:
   * Select type: **Web app**.
   * Description: `CrewClock Attendance Webhook`.
   * **Execute as**: `Me (your email)`.
   * **Who has access**: `Anyone`.
4. Click **Deploy**, authorize permissions when prompted, and copy the generated **Web App URL** (`https://script.google.com/macros/s/.../exec`).
5. When onboarding, paste this Web App URL into the Attendance Sheet field. CrewClock detects the URL format and posts directly to it!

---

### Step 2: Sign Up Your Restaurant Workspace

1. Open your restaurant's CrewClock web portal link (e.g., `https://<username>.github.io/CrewClock/iGrill/`).
2. On Screen 0 (Login View), look for the restaurant registration prompt at the bottom:
   👉 **"Sign Up Your Restaurant with Google"**
3. Select your Google / Gmail account in the Google OAuth popup and grant profile permissions.

---

### Step 3: Complete Workspace Onboarding Form

Immediately after authentication, the **Create Restaurant Workspace** onboarding modal will appear:

| Field | Example Value | Description |
| :--- | :--- | :--- |
| **Restaurant / Location Name** | `Bella Bistro & Bar - Downtown` | The official name of your business displayed to all employees on login and timers. |
| **Logo Image URL** *(Optional)* | `https://example.com/logo.png` | Direct link to your restaurant logo image (PNG/SVG with transparent background recommended). |
| **Attendance Google Sheet ID or URL** | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`<br>*or* `https://docs.google.com/spreadsheets/d/.../edit` | The private Google Sheet ID or URL you secured in Step 1. |
| **Restaurant Time Zone** | `America/Los_Angeles (Pacific Time)` | The official timezone used for calculating employee shifts and shift date cutoffs. |

Click **"Create Workspace & Start →"**.

Within 1–2 seconds:
- Your restaurant is registered as a new tenant in the central directory.
- Your Google account is assigned the **Workspace Admin** role.
- Your dashboard loads instantly with your custom restaurant name, logo, and the **Admin badge** in the header.

---

### Step 4: Invite Employees to Your Restaurant Team

CrewClock operates on a strict **invitation-only** model. Uninvited users cannot sign in to your workspace.

1. In the top navigation header, click the **Team Management icon (👥)**.
2. In the **Invite Team Member** section at the top:
   * **Employee Gmail Address**: Enter your employee's genuine personal or business `@gmail.com` address.
   * **Employee Full Name**: Enter their display name (e.g., `Sarah Jenkins` or `Chef Marco`).
3. Click **Send Invitation**.
4. CrewClock immediately:
   * Registers the employee under your tenant workspace in the central directory.
   * Dispatches a branded invitation email to their Gmail inbox containing:
     - Your restaurant name and manager's name.
     - Direct login link to the web portal.
     - Simple instructions to tap **"Sign In with Google"**.

---

### Step 5: Managing the Team Roster & Offboarding

In the **Team Management (👥)** modal, you can monitor your active staff roster:
* **Active Members List**: Displays each employee's name, email address, role (`admin` or `employee`), and registration date.
* **Instant Offboarding / Revocation**: If an employee leaves your restaurant or is terminated, click the red **Remove** button next to their name. Their access is revoked in real time in the directory, preventing any future clock-ins or portal access.
* **Workspace Settings (⚙️)**: Click the **Settings** icon in the header at any time to:
  - Update your restaurant display name or logo.
  - Switch or update your Google Sheet ID or Apps Script Webhook.
  - Change operational timezone.

---

### Step 6: Real-Time Attendance Auditing & Payroll Export

#### Accessing Your Attendance Sheet
At any time, click the **"Open Sheet ↗"** link located right next to the **"Tamper-Proof Google Sheet"** status badge in your header to jump directly to your private Google Sheet.

#### Understanding the 11 Audit Columns
When staff clock in and out, CrewClock writes records with 11 forensic auditing columns:

| Col | Header | Sample Data | Description / Audit Purpose |
| :---: | :--- | :--- | :--- |
| **A** | `Email` | `sarah.jenkins@gmail.com` | Verified Google OAuth account used to clock in. |
| **B** | `Employee Name` | `Sarah Jenkins` | Display name of employee. |
| **C** | `Clock-In Time` | `Sep 04, 2026 08:30 AM` | Authoritative Google Cloud server timestamp at clock-in. |
| **D** | `Clock-In Location` | `37.77490, -122.41940` | Precise GPS coordinates captured at clock-in. |
| **E** | `Accuracy` | `6 m` | Hardware GPS accuracy radius (flags spoofing/poor reception). |
| **F** | `Clock-In Map` | `[In Map Link]` | Clickable hyperlink to Google Maps pin showing exact location. |
| **G** | `Clock-Out Time` | `Sep 04, 2026 04:30 PM` | Authoritative Google Cloud server timestamp at clock-out. |
| **H** | `Clock-Out Location`| `37.77501, -122.41925` | Re-verified ending GPS coordinates captured at clock-out. |
| **I** | `Clock-Out Map` | `[Out Map Link]` | Clickable hyperlink to ending Google Maps pin. |
| **J** | `Shift Duration` | `8h 0m` | Authoritatively computed shift duration. |
| **K** | `Status` | `Completed` | Shift status (`Active Shift` during shift, `Completed` once clocked out). |

#### Exporting to Payroll (QuickBooks, Gusto, ADP, Excel)
Because your data is stored in standard Google Sheets:
1. Click **File > Download > Comma Separated Values (.csv)** or **Microsoft Excel (.xlsx)**.
2. Upload the CSV directly into your payroll processor (Gusto, QuickBooks Payroll, ADP, Paychex).
3. You can also add custom formula columns starting at Column `L` (such as `Hourly Rate`, `Overtime`, `Tips`, or `Total Pay`) or create Pivot Tables in another tab—CrewClock will never overwrite your custom formulas!

---

### Merchant Admin Troubleshooting & FAQs

#### Q1: When an employee clocks in, it says "Service does not have permission to access your Google Sheet". How do I fix this?
**A**: This means you haven't shared your Google Sheet with the platform service email. Open your Google Sheet in Google Drive, click the green **Share** button, enter the Platform Service Email shown in your onboarding/settings dialog, set the permission to **Editor**, and click **Share**.

#### Q2: What if I pasted the wrong Google Sheet ID or want to switch to a new sheet for the new month/year?
**A**: Click the **Settings icon (⚙️)** in the top navigation bar of CrewClock, paste the new Google Sheet ID or URL, and click **Save Settings**. Future shifts will immediately begin recording in the new spreadsheet.

#### Q3: Can an employee clock in while away from the restaurant?
**A**: Every clock-in and clock-out captures the device's exact GPS coordinates and generates a clickable Google Maps link in Columns F and I of your Google Sheet. You can click these links during payroll review to verify whether the employee was on restaurant premises.

#### Q4: What if an employee forgot to clock out?
**A**: In your Google Sheet, look for rows where Column K is `Active Shift` and Column G (`Clock-Out Time`) is blank. As the spreadsheet owner, you can manually enter the clock-out time and update the status to `Completed`.

#### Q5: Can I customize columns in my attendance sheet?
**A**: Yes! Columns A through K are managed by CrewClock. Feel free to use Column L onwards for internal notes, hourly wage calculations (`=J2*18.50`), tip pools, or manager sign-offs.

---

## 6. Employee User Guide

### Accepting Your Invitation

1. When your manager adds you to the team, you will receive an email from CrewClock in your Gmail inbox:
   * **Subject**: `Invitation to join [Restaurant Name] on CrewClock`
   * **Body**: Contains your restaurant name, manager's name, and a **"Sign In to CrewClock Portal"** button.
2. Click the link to open the app on your mobile phone or web browser.

### One-Time Google Sign-In

1. On the main screen, tap:
   👉 **"Sign In with Google"**
2. Choose the Gmail account that received the invitation.
3. You are instantly authenticated! CrewClock remembers your session for **7 days**. You will not need to sign in again for your shifts throughout the week.

### Clocking In for a Shift

1. When you arrive at the restaurant, open the app.
2. You will see your greeting: **"Ready for your shift, [Your Name]?"**
3. Tap the large green button:
   👉 **"Clock In"**
4. If prompted by your phone browser, tap **"Allow"** to share your GPS location.
5. In 1–2 seconds, your clock-in is registered with the exact server time and location coordinates.

### During Shift & Active Timer

While clocked in, the app displays:
* Your clock-in time (e.g., `08:30 AM`).
* A live shift duration counter updating every second (`02h 15m 42s`).
* Your GPS location verification coordinates and accuracy radius.
* You can safely close your browser or phone app—your shift continues counting on the server!

### Clocking Out & Shift Summary

1. At the end of your shift, open the app.
2. Tap the large red button:
   👉 **"Clock Out"**
3. Confirm the dialog prompt.
4. Your ending location and timestamp are recorded in the Google Sheet, and the app presents your shift summary:
   > *"Great work today, Sarah! You worked 7h 48m. Your clock-out was recorded at 04:18 PM."*
5. Tap **Done**. You are returned to the Ready screen, still signed in for your next shift!

### Reviewing Shift History

* Tap the **History icon (🕒)** in the top header to view your recent shift logs, total hours worked, and links to your clock-in/out GPS coordinates on Google Maps.

---

## 7. Native Mobile Apps Guide

CrewClock includes production-ready wrappers for deploying native iOS and Android apps.

### iOS Native Wrapper (WKWebView)

* **Directory**: [`iGrill/ios/`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/iGrill/ios/)
* **Xcode Project**: `CrewClock.xcodeproj`
* **Features**:
  * Fullscreen native container with pull-to-refresh (`UIRefreshControl`).
  * Seamless Google OAuth popup interception (`createWebViewWithConfiguration`).
  * Location permissions configured via `NSLocationWhenInUseUsageDescription`.
* **Testing on Physical iPhone**:
  1. Open `CrewClock.xcodeproj` in Xcode on a Mac.
  2. Connect your iPhone via USB / WiFi.
  3. Select your Personal Apple ID team under **Signing & Capabilities**.
  4. Click **Run (Cmd+R)** to install directly onto your iPhone for free.
  5. Detailed instructions are available in the [iOS Guide](file:///Users/venkata/workspace/PersonalBranding/CrewClock/iGrill/ios/README.md).

### Android Native Wrapper (WebView)

* **Directory**: [`iGrill/android/`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/iGrill/android/)
* **Features**:
  * `SwipeRefreshLayout` support.
  * Custom User-Agent configuration to eliminate Google OAuth 403 `disallowed_useragent` blocks on embedded WebViews.
  * Native GPS bridge implementing `WebChromeClient.onGeolocationPermissionsShowPrompt`.
* **Building APK**:
  1. Open `iGrill/android` in Android Studio.
  2. Build APK via **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
  3. Detailed instructions are available in the [Android Guide](file:///Users/venkata/workspace/PersonalBranding/CrewClock/iGrill/android/README.md).

### Zero-Rebuild Auto-Update Architecture

Both native apps are configured to load the live web portal URL directly from GitHub Pages:
```swift
// iOS ViewController.swift
let webAppURL = URL(string: "https://naninice2000.github.io/CrewClock/iGrill/")!
webView.load(URLRequest(url: webAppURL))
```
Whenever you update code in GitHub:
* Changes take effect instantly for all web, iOS, and Android users.
* **No App Store reviews or APK redistributions required.**

---

## 8. Spreadsheet Schemas Reference

### 1. Central Directory: `Tenants` Tab
Managed automatically by `google-apps-script-tenancy.js`:

| Column | Header | Type | Description |
| :---: | :--- | :--- | :--- |
| **A** | `Tenant ID` | String | Unique tenant identifier (e.g., `t_a1b2c3d4`) |
| **B** | `Restaurant Name` | String | Commercial business display name |
| **C** | `Logo URL` | String | URL of restaurant logo image |
| **D** | `Admin Email` | String | Verified Gmail address of the workspace creator |
| **E** | `Attendance Sheet URL` | String | Webhook URL for the restaurant's private sheet |
| **F** | `Time Zone` | String | IANA timezone string (e.g., `America/Los_Angeles`) |
| **G** | `Created At` | ISO 8601 | Workspace provisioning timestamp |

### 2. Central Directory: `Users` Tab
Managed automatically by `google-apps-script-tenancy.js`:

| Column | Header | Type | Description |
| :---: | :--- | :--- | :--- |
| **A** | `User Email` | String | Normalized lowercase Gmail address |
| **B** | `User Name` | String | Employee full display name |
| **C** | `Role` | String | `admin` or `employee` |
| **D** | `Tenant ID` | String | Affiliated restaurant tenant ID |
| **E** | `Status` | String | `active` or `revoked` |
| **F** | `Invited By` | String | Admin email who authorized the invitation |
| **G** | `Created At` | ISO 8601 | User registration timestamp |

### 3. Operational Attendance Sheet: `Attendance` Tab
Managed automatically by `google-apps-script.js`:

| Col | Header | Sample Data | Description |
| :---: | :--- | :--- | :--- |
| **A** | `Email` | `sarah.jenkins@gmail.com` | Authenticated Google user |
| **B** | `Employee Name` | `Sarah Jenkins` | Profile display name |
| **C** | `Clock-In Time` | `Sep 04, 2026 08:30 AM` | Server-synchronized timestamp |
| **D** | `Clock-In Location`| `37.77490, -122.41940` | Device GPS coordinates |
| **E** | `Accuracy` | `6 m` | Hardware GPS confidence |
| **F** | `Clock-In Map` | `[In Map Link]` | Google Maps hyperlink |
| **G** | `Clock-Out Time` | `Sep 04, 2026 04:30 PM` | Server-synchronized timestamp |
| **H** | `Clock-Out Location`| `37.77501, -122.41925` | Re-verified ending GPS |
| **I** | `Clock-Out Map` | `[Out Map Link]` | Ending Google Maps hyperlink |
| **J** | `Shift Duration`| `8h 0m` | Authoritative elapsed duration |
| **K** | `Status` | `Completed` | Shift completion status |

---

## 9. Troubleshooting & FAQs

### Q: Why do I see "Access Restricted" when trying to sign in?
**A**: CrewClock enforces an invitation-only security policy. Your Gmail address must first be invited by an authorized Restaurant Admin via the Team Management modal (👥) before you can sign in. If you are a restaurant owner starting a new location, click **"Sign Up Your Restaurant with Google"** instead.

### Q: Does Google Apps Script have usage limits?
**A**: Google Apps Script provides **20,000+ free URL fetch calls and executions per day** for standard personal `@gmail.com` accounts, and up to **100,000/day** for Google Workspace accounts. For a typical restaurant running 50 shifts per day, CrewClock consumes less than 0.5% of the daily free quota.

### Q: What if an employee denies location access?
**A**: The app requires GPS permissions to verify physical presence on site. If denied, a helpful message explains how to enable location in their browser settings (iOS: *Settings > Safari > Location*; Android: *Chrome > Site Settings > Location*).

### Q: How do I change my restaurant logo or attendance spreadsheet later?
**A**: Log in as the Admin, click the **Settings icon (⚙️)** in the top header, update your Logo URL or Attendance Script URL, and click **Save Settings**. The changes automatically synchronize to the Central Directory and take effect immediately.

### Q: Can an employee edit the Google Sheet directly?
**A**: No. The Google Sheet is private to the restaurant owner. Employees interact with the spreadsheet exclusively through the Apps Script webhook, meaning they cannot tamper with existing rows, edit formulas, or view salary/time logs of coworkers.

---
*Maintained by the CrewClock Core Team. Built for modern, agile hospitality teams.*
