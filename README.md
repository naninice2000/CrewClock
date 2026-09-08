# ⏰ SheetPunch - Restaurant Staff Attendance & Time Clock

A unified mobile attendance and employee time clock system with **tamper-proof Google Server Time**, **GPS Geolocation**, and **Native iOS & Android App Wrappers**.

* **Live Web App**: **`https://naninice2000.github.io/CrewClock/`**
* **Native iOS App**: [`ios/CrewClock.xcodeproj`](ios/CrewClock.xcodeproj)
* **Native Android App**: [`android/`](android/)
* **Decoupled Buffer Service**: [`buffer-service/`](buffer-service/)
* **Full Project Wiki & Architectural Blueprints**: [`WIKI.md`](WIKI.md)

---

## 📁 Repository Overview

* **[`index.html`](index.html), [`app.js`](app.js), [`style.css`](style.css)**: The hosted web application (HTML5, Tailwind CSS, Google Identity Services, Google Apps Script).
  * Auto-logs attendance, timestamps, GPS coordinates, and Google Maps pins directly to your **Google Sheet**.
  * Calculates shift duration directly on Google's cloud servers in your restaurant's time zone.
  * Instant Sandbox/Test Simulator for testing payment success, card declines, and subscription renewal failures.
* **[`ios/`](ios/)**: The native iOS application (`CrewClock.xcodeproj`).
  * Built with Swift, SwiftUI, and WebKit (`WKWebView`).
  * Wraps the live hosted web app so **any changes pushed to GitHub Pages are instantly reflected without needing App Store updates**.
  * Full support for iOS GPS location permissions and Google Sign-In popups.
* **[`android/`](android/)**: The native Android application (Gradle project).
  * Built with Kotlin, Android Jetpack, and `WebView`.
  * Features automatic User-Agent sanitization for Google Sign-In (`403 disallowed_useragent` bypass), GPS geolocation bridging, pull-to-refresh, and offline support.
* **[`js/`](js/)**: Modular JavaScript application architecture broken into 14 domain modules (auth, clock, geo, sheets, queue, team, billing, dom, state, etc.) bundled into production `app.js` via `node scripts/build.js`.
* **[`GScript/`](GScript/)**: Backend Google Apps Script deployments (`google-apps-script-tenancy.js` with CacheService in-memory acceleration, `google-apps-script-payments.js`, and `google-apps-script.js`).
* **[`test/`](test/)**: Automated End-to-End Behavior-Driven Development (BDD) testing suite powered by **Python**, **Playwright**, and **Behave** with 100% offline Google Apps Script mocking.
* **[`buffer-service/`](buffer-service/)**: Optional high-throughput decoupled microservice (Node.js/Express) for burst smoothing.

---

## 🏛️ Multi-Tenant & RBAC Architecture

The platform utilizes Google Sheets for complete isolation between tenant directory management and individual restaurant attendance logs, accelerated by Google Apps Script **`CacheService`** for sub-50ms in-memory authentication and dynamic trial/subscription evaluation:

```
┌─────────────────────────────────────────────────────────────────────────┐
│              CENTRAL MULTI-TENANT DIRECTORY (Google Sheet)              │
│            Managed by: GScript/google-apps-script-tenancy.js            │
│               • CacheService In-Memory Cache (Sub-50ms)                 │
│               • Instant Cache Invalidation on Member/Plan Changes       │
│                                                                         │
│   [Tenants Sheet]                               [Users Sheet]           │
│   • Tenant ID                                   • User Email (Google)   │
│   • Restaurant Name                             • User Name             │
│   • Logo URL                                    • Role (admin/employee) │
│   • Admin Email                                 • Tenant ID             │
│   • Attendance Sheet Script URL                 • Status (active)       │
│   • Timezone                                    • Invited By            │
│   • Subscription Status & Expiry                • Created At            │
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
   - Click **"Sign Up Your Business with Google"** with an instant 14-day free trial.
   - Name their business workspace, logo URL, and provide their Attendance Sheet Script URL.
   - Access to **Team Management** (👥): Invite employees by Google / Google Workspace email and remove staff.
   - Access to **Billing & Subscription** (💳): Manage Starter, Growth, or Pro Crew monthly/yearly plans with Q PaymentZ integration.
   - Access to **App Configuration** (⚙️): Update branding and sheet settings.
2. **Employees (Staff Members)**:
   - Click **"Sign In with Google"**.
   - Directly routed into their restaurant's branded portal.
   - Simplified UI: Only Clock-In, Clock-Out, and personal shift history are visible.
   - **No App Configuration or Team Management access**.
3. **Uninvited Users**:
   - If an uninvited Google user tries to sign in, they are blocked with an "Access Restricted" alert instructing them to contact their manager.

---

## ⏱️ Shift Flow: Persistent Login & Action-Triggered Attendance

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

## 📊 Google Sheet Layouts

### 1. Central "Tenants & Users Directory" Sheet (Platform Level)
* **`Tenants` tab**: `[Tenant ID, Restaurant Name, Logo URL, Admin Email, Attendance Sheet URL, Time Zone, Created At, Subscription Status, Trial Ends At, Plan, Billing Cycle, Paid Amount, Payment Date, Payment Reference, Subscription Ends At]`
* **`Users` tab**: `[User Email, User Name, Role, Tenant ID, Status, Invited By, Created At]`

### 2. Dedicated "Payments & Billing Ledger" Sheet (Platform Level)
* **`Payments` tab**: `[Transaction ID, Timestamp, Tenant ID, Admin Email, Plan Name, Plan Key, Billing Cycle, Amount Paid, Amount (Cents), Status, Card Brand, Last 4, Auth Code, Environment, Idempotency Key]`

### 3. Individual Restaurant "Attendance" Sheets (One Per Restaurant)
Each shift is recorded as a single row with full dual-location auditing:

| Col A: Email | Col B: Employee Name | Col C: Clock-In Time | Col D: Clock-In Location | Col E: Accuracy | Col F: Clock-In Map | Col G: Clock-Out Time | Col H: Clock-Out Location | Col I: Clock-Out Map | Col J: Shift Duration | Col K: Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `alex@gmail.com` | `Alex Rivera` | `09/04/2026 08:30 AM` | `37.7749, -122.4194` | `6 m` | `[In Map]` | `09/04/2026 04:30 PM` | `37.7750, -122.4192` | `[Out Map]` | `8h 0m` | `Completed` |

---

## 🛠️ Setup Guides

### 1. Central Multi-Tenant Directory Sheet
1. Open [sheets.new](https://sheets.new) and name it: **`SheetPunch - Tenants & Users Directory`**.
2. Click **Extensions > Apps Script**, paste [`GScript/google-apps-script-tenancy.js`](GScript/google-apps-script-tenancy.js).
3. Deploy as **Web app** (`Execute as: Me`, `Who has access: Anyone`).
4. Copy the Web app URL and paste into `config.js` as `tenancyScriptUrl`.

### 2. Dedicated Payments Engine (Q PaymentZ)
1. Open [sheets.new](https://sheets.new) and name it: **`SheetPunch - Payments & Billing Ledger`**.
2. Click **Extensions > Apps Script**, paste [`GScript/google-apps-script-payments.js`](GScript/google-apps-script-payments.js).
3. In **Project Settings > Script Properties**, set:
   * `QPZ_ENVIRONMENT`: `sandbox` (or `production`)
   * `QPZ_CLIENT_ID`: `<Your Client ID>`
   * `QPZ_CLIENT_SECRET`: `<Your Client Secret>`
   * `TENANCY_SCRIPT_URL`: `<Your Tenancy Directory Web App URL>`
4. Deploy as **Web app** (`Execute as: Me`, `Who has access: Anyone`).
5. Copy the Web app URL and paste into `config.js` as `paymentsScriptUrl`.

### 3. Google Cloud OAuth Setup
1. In the [Google Cloud Console](https://console.cloud.google.com/), enable **Google Sheets API**.
2. Configure OAuth consent screen with scopes: `userinfo.email`, `userinfo.profile`, `spreadsheets`.
3. Create OAuth client ID (Web application) with authorized origins:
   * `http://localhost:8000`
   * `https://<your-username>.github.io`
4. Paste Client ID into `config.js` as `googleClientId`.

---

## 📱 Native Mobile Apps

### 🍎 Native iOS App
* **Xcode Project**: [`ios/CrewClock.xcodeproj`](ios/CrewClock.xcodeproj)
* **Build via Command Line**:
  ```bash
  xcodebuild -project ios/CrewClock.xcodeproj -scheme CrewClock -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
  ```
* **Run in Simulator**:
  ```bash
  xcodebuild -project ios/CrewClock.xcodeproj -scheme CrewClock -destination 'generic/platform=iOS Simulator' build
  ```
* See [`ios/README.md`](ios/README.md) for full physical iPhone developer install instructions.

### 🤖 Native Android App
* **Android Project**: [`android/`](android/)
* **Build APK via Gradle**:
  ```bash
  cd android
  ./gradlew assembleDebug
  ```
  Generates APK at: `android/app/build/outputs/apk/debug/app-debug.apk`
* See [`android/README.md`](android/README.md) for install and ADB sideloading instructions.

### 📱 In-App Mobile Optimizations
* **Custom Confirm Dialog (`showConfirmDialog`)**: Bypasses browser-native `window.confirm()` which is blocked or suppressed in iOS `WKWebView` and Android `WebView`, ensuring reliable Clock-Out and Logout confirmations.
* **Safe Area Inset Protection**: Integrated `env(safe-area-inset-bottom)` and modal max-height viewport constraints ensure bottom checkout and confirmation buttons remain fully visible on Dynamic Island / notched iPhones.

---

## 💻 Local Development & Build

### 1. Build Frontend Bundle
```bash
npm run build
```
Concatenates and bundles modular JavaScript files from [`js/`](js/) into production [`app.js`](app.js).

### 2. Local Preview Server
```bash
python3 -m http.server 8000
```
Open `http://localhost:8000` in your web browser.

---

## 🧪 Automated BDD Testing (Python + Playwright + Behave)

CrewClock includes a comprehensive Behavior-Driven Development (BDD) test automation suite located in [`test/`](test/).

### Architecture & Key Capabilities
* **Pure Python BDD (`behave`)**: Gherkin `.feature` specifications executed directly via Python's native Cucumber runner.
* **Zero External Google Dependencies**: All Google Apps Script (`script.google.com/**`) and Google Sheets (`sheets.googleapis.com/**`) network calls are 100% intercepted and mocked via Playwright's `page.route()`. Tests run completely offline with zero quota consumption or production sheet pollution.
* **Page Object Model (POM)**: High-level UI abstraction layer in [`test/pages/clock_page.py`](test/pages/clock_page.py).
* **GPS Emulation & Session Injection**: Headless Chromium simulates hardware GPS coordinates (`37.7749°, -122.4194°`) and injects deterministic sessions to bypass third-party OAuth popups.
* **Ephemeral Local Web Server**: Automatically launches a background Python HTTP server on an open ephemeral port (`127.0.0.1:0`) in [`test/features/environment.py`](test/features/environment.py) and tears it down after test completion.

### Test Environment Setup
```bash
# 1. Create and activate Python virtual environment
python3 -m venv .venv

# 2. Install test dependencies (behave, playwright)
.venv/bin/pip install -r test/requirements.txt

# 3. Install Playwright browser binaries
.venv/bin/playwright install chromium
```

### Running Tests (Native Python Behave)
Run the entire BDD test suite:
```bash
.venv/bin/behave test/features
```
*(Or simply `behave test/features` when your `.venv` is activated)*

Run individual features:
```bash
.venv/bin/behave test/features/clock.feature    # Clock-in, shift duration timer, clock-out
.venv/bin/behave test/features/team.feature     # Team roster view, employee invitation
.venv/bin/behave test/features/billing.feature  # Plan pricing, monthly/annual toggles, sandbox payment
```

### Test Directory Layout
```
test/
├── README.md                      # Test suite documentation & quick start
├── requirements.txt               # Dependencies: behave>=1.2.6, playwright>=1.42.0
├── mocks/
│   └── apps_script_mock.py        # Network route interceptor for Apps Script & Sheets APIs
├── pages/
│   └── clock_page.py              # Page Object Model (POM) locators & user actions
└── features/
    ├── environment.py             # Server boot, browser init, and mock routing hooks
    ├── clock.feature              # Clock In, active shift timer, GPS capture, Clock Out
    ├── team.feature               # RBAC access, directory roster loading, staff invitations
    ├── billing.feature            # Tiered pricing, annual discount toggle, sandbox checkout
    └── steps/
        ├── common_steps.py        # Shared auth steps (Admin & Employee sign-in injection)
        ├── clock_steps.py         # Step mappings for clock.feature
        ├── team_steps.py          # Step mappings for team.feature
        └── billing_steps.py       # Step mappings for billing.feature
```
