# Restaurant Staff Attendance & Time Clock Web App (Multi-Tenant)

A 100% serverless Employee Clock-In & Attendance Web App hosted directly on **GitHub Pages**, combining **Google Authentication (Gmail & Google Workspace)** with **Google Apps Script** for automatic, secure logging to **Google Sheets**.

Now features **Multi-Tenancy & Role-Based Access Control (RBAC)**: Multiple restaurants and locations can use the same system, manage their own branding and team rosters, and log clock-ins to their own dedicated Attendance Sheets.

---

## Multi-Tenant & RBAC Architecture

The system utilizes two Google Sheets for complete isolation between tenant directory management and individual restaurant attendance logs:

```
┌─────────────────────────────────────────────────────────────────────────┐
│              CENTRAL MULTI-TENANT DIRECTORY (Google Sheet)              │
│                  Managed by: google-apps-script-tenancy.js              │
│                                                                         │
│   [Tenants Sheet]                               [Users Sheet]           │
│   • Tenant ID                                   • User Email (Google)   │
│   • Restaurant Name                             • User Name             │
│   • Logo URL                                    • Role (admin/employee) │
│   • Admin Email                                 • Tenant ID             │
│   • Attendance Sheet Script URL                 • Status (active)       │
│   • Timezone                                    • Invited By            │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   [Restaurant A Portal]                     [Restaurant B Portal]
   • Admin: alice@company.com                • Admin: bob@gmail.com
   • Employees: staff1, staff2               • Employees: chef1, waiter1
   • Attendance Sheet URL: Script A          • Attendance Sheet URL: Script B
              │                                         │
              ▼                                         ▼
┌───────────────────────────┐             ┌───────────────────────────┐
│ Attendance Google Sheet A │             │ Attendance Google Sheet B │
│ (Clock-In / Clock-Out)    │             │ (Clock-In / Clock-Out)    │
└───────────────────────────┘             └───────────────────────────┘
```

### Role-Based Access Control (RBAC):
1. **Restaurant Owners (Admins)**:
   - Click **"Sign Up Your Restaurant with Google"**.
   - Create and name their restaurant workspace, logo URL, and provide their restaurant's Attendance Sheet Script URL.
   - Access to **Team Management** (👥): Invite employees by Google / Google Workspace email (sends automated email invitation via Google MailApp) and remove staff.
   - Access to **App Configuration** (⚙️): Update branding and sheet settings.
2. **Employees (Staff Members)**:
   - Click **"Sign In with Google"**.
   - Directly routed into their restaurant's branded portal.
   - Simplified UI: Only Clock-In, Clock-Out, and personal shift history are visible.
   - **No App Configuration or Team Management access**.
3. **Uninvited Users**:
   - If an uninvited Google user tries to sign in, they are blocked with an "Access Restricted" alert instructing them to contact their manager.

---

## Shift Flow: Persistent Login & Action-Triggered Attendance

```
[Employee Phone / Mobile App]
   │
   ├─► 1. "Sign In with Google" (One-Time Login)
   │      └─ Authenticates Google identity via Google Identity Services (GIS OAuth 2.0)
   │      └─ Validates role and tenant against Central Tenancy Directory
   │      └─ Saves persistent 7-day session in localStorage
   │
   ├─► 2. "Clock In" (Off Shift)
   │      └─ Captures device GPS coordinates at click moment
   │      └─ Posts to Restaurant's Attendance Sheet Webhook
   │      └─ Records: [Email, Name, ClockIn, InLocation, InAcc, InMap, (blank), (blank), (blank), (blank), "Clocked In"]
   │      └─ Activates live shift duration timer
   │
   └─► 3. "Clock Out" (Active Shift)
          └─ Captures device GPS coordinates at clock-out click moment
          └─ Posts to Restaurant's Attendance Sheet Webhook
          └─ Updates same row: [..., ClockOut, OutLocation, OutMap, Duration, "Completed"]
          └─ Displays shift completion summary; employee stays signed in for next shift!
```

---

## Google Sheet Layouts

### 1. Central "Tenants & Users Directory" Sheet (Created Once by Platform Owner)
* **`Tenants` tab**: `[Tenant ID, Restaurant Name, Logo URL, Admin Email, Attendance Sheet URL, Time Zone, Created At]`
* **`Users` tab**: `[User Email, User Name, Role, Tenant ID, Status, Invited By, Created At]`

### 2. Individual Restaurant "Attendance" Sheets (One Per Restaurant)
Each shift is recorded as a single row with full dual-location auditing:

| Col A: Email | Col B: Employee Name | Col C: Clock-In Time | Col D: Clock-In Location | Col E: Accuracy | Col F: Clock-In Map | Col G: Clock-Out Time | Col H: Clock-Out Location | Col I: Clock-Out Map | Col J: Shift Duration | Col K: Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `alex@gmail.com` | `Alex Rivera` | `09/04/2026 08:30 AM` | `37.7749, -122.4194` | `6 m` | `[In Map]` | `09/04/2026 04:30 PM` | `37.7750, -122.4192` | `[Out Map]` | `8h 0m` | `Completed` |

---

## Setup Guide: 1. Central Multi-Tenant Directory Sheet (Platform Level)

1. Open [sheets.new](https://sheets.new) to create a new Google Sheet.
2. Name it: **`SheetPunch - Tenants & Users Directory`**.
3. In the top menu, click **Extensions > Apps Script**.
4. Delete any existing code and paste [`google-apps-script-tenancy.js`](google-apps-script-tenancy.js).
5. Click **Deploy** (top right blue button) > **New deployment**.
6. Click the gear icon next to "Select type" and choose **Web app**:
   - **Description**: `SheetPunch Central Directory & RBAC`
   - **Execute as**: `Me (your email)`
   - **Who has access**: `Anyone`
7. Click **Deploy**, click **Authorize access**, and copy your **Web app URL**.
8. Paste this URL into [`config.js`](config.js) under `tenancyScriptUrl` (or enter in Settings modal).

---

## Setup Guide: 2. Restaurant Attendance Sheet (Per Restaurant)

Merchants have two flexible options for their attendance sheet:

### 🏆 Choice A (Recommended): Tamper-Proof Google Sheet ID
Restaurant owners keep 100% ownership of their data in their personal Google Drive without writing any code. Employees have **ZERO access to the sheet**, making it impossible for staff to edit or tamper with their hours.
1. Open [sheets.new](https://sheets.new) and name it: `[Restaurant Name] - Staff Attendance`.
2. Ensure the sheet time zone matches the restaurant: **File > Settings > Time zone**.
3. **Share with Platform Email**: Click **Share** (top right) and share with your platform service email (the Gmail hosting `google-apps-script-tenancy.js`) as **Editor**. 
   > *Security Note: Do NOT share this sheet with your employees. The SheetPunch app will securely record clock-in/out records via the central backend. Employees never have direct edit or view permissions!*
4. **Copy the Sheet ID or URL**: Copy the browser URL or copy the ID between `/d/` and `/edit` (e.g. `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`).
5. Enter this Sheet ID or URL when signing up under **Attendance Google Sheet ID or URL**.
   > *SheetPunch automatically initializes the `Attendance` tab with the 11 auditing header columns on the first clock-in.*

### ⚙️ Choice B (Optional): Custom Google Apps Script Webhook
If a merchant prefers running their own independent Apps Script Webhook:
1. In their Google Sheet, open **Extensions > Apps Script**, paste [`google-apps-script.js`](google-apps-script.js), and deploy as a Web App (`Execute as: Me`, `Who has access: Anyone`).
2. Paste the resulting Web App URL (`https://script.google.com/macros/s/.../exec`) into the **Attendance Google Sheet ID or URL** field. SheetPunch detects the URL format and posts directly to it!

---

## Google Cloud Setup (OAuth 2.0 Web Client ID & Sheets API)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Staff-ClockIn`).
3. Under **APIs & Services > Library**:
   - Search for **Google Sheets API** and click **Enable**.
4. Under **APIs & Services > OAuth consent screen**:
   - User Type: **External**
   - App Name: `Staff Time Clock`
   - Scopes: Add `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `https://www.googleapis.com/auth/spreadsheets`.
   - Under **Test users**, add your Gmail address and staff emails.
5. Under **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth client ID**.
   - Application Type: **Web application**.
   - **Authorized JavaScript origins**:
     - `http://localhost:8000` (for local testing)
     - `https://<your-github-username>.github.io` (for GitHub Pages)
   - Click **Create** and copy your **Client ID** (`123456789-xxx.apps.googleusercontent.com`).
6. Paste your **Client ID** into [`config.js`](config.js) under `googleClientId`.

---

## Deploying to GitHub Pages

1. Commit and push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Employee Clock-In Web App"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. Go to your repository on GitHub > **Settings** > **Pages**.
3. Under **Source**, choose **Deploy from a branch**.
4. Select **main** and folder **/ (root)**, then click **Save**.
5. Your app is live at `https://<your-username>.github.io/<your-repo-name>/`.

---

## Local Development & Testing

```bash
python3 -m http.server 8000
```
Open `http://localhost:8000` in your web browser.

---

## 📱 Native Mobile Apps

Native wrappers for iOS and Android are available in this directory:

### 🍎 Native iOS App
* **Xcode Project**: [`ios/CrewClock.xcodeproj`](ios/CrewClock.xcodeproj)
* **Features**: Embedded `WKWebView`, GPS Geolocation permissions, Google Sign-In popup handling, pull-to-refresh, and offline support.
* **Auto-Updating**: Directly loads `https://naninice2000.github.io/CrewClock/iGrill/` so web updates reflect immediately without App Store re-submission.
* **Build & Dev Phone Install Guide**: See the [iOS App Guide](ios/README.md) for step-by-step instructions to compile and deploy to your physical iPhone for free.

### 🤖 Native Android App
* **Android Project**: [`android/`](android/)
* **Features**: Embedded `WebView`, GPS Geolocation bridge, Google Sign-In 403 User-Agent fix, `SwipeRefreshLayout` pull-to-refresh, and offline fallback.
* **Auto-Updating**: Directly loads `https://naninice2000.github.io/CrewClock/iGrill/` so web updates reflect immediately without Play Store updates.
* **Setup & Build Guide**: See the [Android App Guide](android/README.md).


