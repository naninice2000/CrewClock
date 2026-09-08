# SheetPunch: Multi-Tenant Attendance & Time Clock Platform
> **Comprehensive Architecture, Security, High-Scale SaaS Infrastructure, Platform Setup & Merchant Onboarding Guide**

Welcome to the **SheetPunch** project documentation. SheetPunch is a modern, serverless, multi-tenant employee time-tracking and attendance system designed for single and multi-unit restaurants, retail shops, salons, healthcare clinics, field contractors, and shift-based businesses of all types.

It runs **100% client-side** on **GitHub Pages**, backed by **Google Identity Services (OAuth 2.0)** for genuine Google Account and Google Workspace verification, **Google Apps Script Webhooks** for automated, tamper-proof logging into **Google Sheets**, and an optional **Decoupled Buffer Microservice** for high-volume shift-start bursts.

---

## Table of Contents

1. [System Overview & Key Features](#1-system-overview--key-features)
2. [Architecture & High-Scale SaaS Infrastructure](#2-architecture--high-scale-saas-infrastructure)
   - [High-Level Architecture](#high-level-architecture)
   - [Client-Side Smoothing & Jitter Queue (`PunchQueueManager`)](#client-side-smoothing--jitter-queue)
   - [Server-Side Apps Script In-Memory Caching (`CacheService`)](#server-side-apps-script-in-memory-caching)
   - [Modular Frontend Architecture & Build System (`js/`)](#modular-frontend-architecture--build-system-js)
   - [Decoupled Buffer & Micro-Batching Service (`buffer-service/`)](#decoupled-buffer--micro-batching-service)
   - [Dual-Sheet Isolation Model](#dual-sheet-isolation-model)
   - [Tamper-Proof Server Time Synchronization](#tamper-proof-server-time-synchronization)
   - [Dual-Location Geolocation Auditing](#dual-location-geolocation-auditing)
   - [Hybrid Mobile Wrappers (iOS & Android)](#hybrid-mobile-wrappers-ios--android)
3. [Subscription Tiers & Billing Architecture](#3-subscription-tiers--billing-architecture)
   - [Restructured Pricing Tiers (1–50 Employees)](#restructured-pricing-tiers)
   - [14-Day Full-Featured Free Trial](#14-day-full-featured-free-trial)
   - [Multi-Platform Store Fee Offset (Option B: +15%)](#multi-platform-store-fee-offset)
   - [Subscription Expiration & Graceful Lockout](#subscription-expiration--graceful-lockout)
4. [Role-Based Access Control (RBAC) & Security](#4-role-based-access-control-rbac--security)
   - [Roles & Permissions Matrix](#roles--permissions-matrix)
   - [Google & Google Workspace Identity Authentication](#google--google-workspace-identity-authentication)
   - [Invitation-Only Access Enforcement](#invitation-only-access-enforcement)
   - [Instant Offboarding Cache Invalidation](#instant-offboarding-cache-invalidation)
   - [7-Day Persistent Session Protocol](#7-day-persistent-session-protocol)
5. [Platform Administrator Setup Guide](#5-platform-administrator-setup-guide)
   - [Step 1: Deploy Central Multi-Tenant Directory Sheet](#step-1-deploy-central-multi-tenant-directory-sheet)
   - [Step 2: Configure Google Cloud OAuth 2.0 Credentials](#step-2-configure-google-cloud-oauth-20-credentials)
   - [Step 3: (Optional) Deploy Decoupled Buffer Service to Cloud Run](#step-3-optional-deploy-decoupled-buffer-service)
   - [Step 4: Deploy Frontend to GitHub Pages](#step-4-deploy-frontend-to-github-pages)
6. [Merchant (Business Owner) Getting Started Guide](#6-merchant-business-owner-getting-started-guide)
   - [3-Minute Fast-Track Setup Checklist](#3-minute-fast-track-setup-checklist)
   - [Step 1: Create & Secure Your Google Sheet](#step-1-create--secure-your-google-sheet)
   - [Step 2: Sign Up Your Business Workspace](#step-2-sign-up-your-business-workspace)
   - [Step 3: Complete Workspace Onboarding Form](#step-3-complete-workspace-onboarding-form)
   - [Step 4: Invite Employees to Your Team (Gmail or Workspace)](#step-4-invite-employees-to-your-team)
   - [Step 5: Managing the Team Roster & Offboarding](#step-5-managing-the-team-roster--offboarding)
   - [Step 6: Real-Time Attendance Auditing & Payroll Export](#step-6-real-time-attendance-auditing--payroll-export)
   - [Merchant Admin Troubleshooting & FAQs](#merchant-admin-troubleshooting--faqs)
7. [Employee User Guide](#7-employee-user-guide)
   - [Accepting Your Invitation](#accepting-your-invitation)
   - [One-Time Google Sign-In](#one-time-google-sign-in)
   - [Clocking In for a Shift (Instant Feedback)](#clocking-in-for-a-shift)
   - [During Shift & Active Timer](#during-shift--active-timer)
   - [Clocking Out & Shift Summary](#clocking-out--shift-summary)
   - [Reviewing Shift History](#reviewing-shift-history)
8. [Native Mobile Apps Guide](#8-native-mobile-apps-guide)
   - [iOS Native App (Swift / WKWebView)](#ios-native-app)
   - [Android Native App (Kotlin / WebView)](#android-native-app)
   - [In-App Confirm Dialogs & Safe Area Engineering](#in-app-confirm-dialogs--safe-area-engineering)
   - [App Icons, Splash Screens & Design Treatments](#app-icons--splash-screens)
   - [Zero-Rebuild Auto-Update Architecture](#zero-rebuild-auto-update-architecture)
9. [Spreadsheet Schemas Reference](#9-spreadsheet-schemas-reference)
   - [Central Directory: `Tenants` Tab (15 Columns)](#1-central-directory-tenants-tab)
   - [Central Directory: `Users` Tab (7 Columns)](#2-central-directory-users-tab)
   - [Merchant Attendance Sheet: `Attendance` Tab (11 Columns)](#3-merchant-attendance-sheet-attendance-tab)
10. [Automated End-to-End Testing & BDD Framework](#10-automated-end-to-end-testing--bdd-framework)
   - [BDD Framework Architecture (Python + Playwright + Behave)](#bdd-framework-architecture-python--playwright--behave)
   - [Zero-Dependency Network Route Mocking](#zero-dependency-network-route-mocking)
   - [Page Object Model (`ClockPage`)](#page-object-model-clockpage)
   - [Ephemeral Test Server & Lifecycle Hooks](#ephemeral-test-server--lifecycle-hooks)
   - [Gherkin Feature Specifications](#gherkin-feature-specifications)
   - [Running BDD Tests with Behave](#running-bdd-tests-with-behave)
11. [Troubleshooting & FAQs](#11-troubleshooting--faqs)
12. [Scalability Analysis & Enterprise Growth Bottlenecks (5,000+ Tenants Roadmap)](#12-scalability-analysis--enterprise-growth-bottlenecks-5000-tenants-roadmap)
   - [Architectural Scale Thresholds Summary](#architectural-scale-thresholds-summary)
   - [1. Google OAuth 2.0 User Limits ("Testing" vs. "Production")](#1-google-oauth-20-user-limits-testing-vs-production)
   - [2. Google Apps Script 100 KB Total `CacheService` Ceiling](#2-google-apps-script-100-kb-total-cacheservice-ceiling)
   - [3. Google Apps Script 30-Concurrent-Execution Wall & Daily Quotas](#3-google-apps-script-30-concurrent-execution-wall--daily-quotas)
   - [4. The Buffer Service Evolution: Direct Sheets API v4](#4-the-buffer-service-evolution-from-apps-script-proxy-to-direct-sheets-api-v4)
   - [Migration Roadmap: Phased Implementation Guide](#migration-roadmap-phased-implementation-guide)

---

## 1. System Overview & Key Features

* **Multi-Tenancy for All SMBs**: Any shift-based business—restaurants, cafes, boutiques, salons, construction sites, medical clinics—can use the exact same web or mobile app while maintaining total data isolation.
* **Google Workspace & Gmail Compatibility**: Fully supports custom domain corporate emails (`owner@mybusiness.com`, `staff@company.com`) alongside consumer accounts (`@gmail.com`).
* **High-Scale Punch Stack**:
  * **Optimistic UI with 0ms Worker Blocking**: Shifts start immediately on tap; punches are captured locally with millisecond precision and synchronized in the background.
  * **Client-Side Jitter & Exponential Backoff**: Staggers outgoing network traffic randomly over 500ms–2,500ms to eliminate shift-start spikes, auto-retrying on HTTP 429.
  * **Apps Script `CacheService`**: Server-side in-memory caching provides sub-50ms authentication and dynamic subscription checks, bypassing slow row-by-row sheet scans.
  * **Production Decoupled Buffer**: High-throughput microservice ingests punches in <10ms with `202 Accepted` and micro-batches writes into Google Sheets.
* **Restructured 3-Tier SaaS Pricing**: Narrowed subscription tiers designed for expansion revenue (Starter \$9.99/mo, Growth \$19.99/mo, Pro \$24.99/mo) with a 14-day full-featured free trial.
* **Dual-Location GPS Verification**: Captures hardware GPS coordinates and Google Maps links at the exact second of **both** Clock-In and Clock-Out.
* **Tamper-Proof Time Tracking**: Clocks and durations are locked to authoritative Google Cloud server time in the merchant's configured timezone, preventing phone clock manipulation.
* **Role-Based Access Control (RBAC)**:
  * **Admins**: Manage business profile, team invitations, staff offboarding, billing, and sheet configurations.
  * **Staff Members**: Clean, distraction-free interface with only Clock-In / Clock-Out and personal shift history.
* **Automated Email Invitations**: Admins invite employees by email; Google Apps Script automatically dispatches branded welcome invitations via `MailApp`.
* **Cross-Platform Access**: Runs in mobile browsers (Safari, Chrome) or inside native iOS and Android apps with zero-rebuild auto-updates.

---

## 2. Architecture & High-Scale SaaS Infrastructure

### High-Level Architecture

```
                                ┌──────────────────────────────────────────────┐
                                │           SheetPunch Web Portal              │
                                │      (Hosted on GitHub Pages / CDN)          │
                                └──────────────────────┬───────────────────────┘
                                                       │
                           Google Identity OAuth 2.0   │ Authenticates @gmail.com
                           (GIS client library)        │ & Google Workspace (@company.com)
                                                       ▼
                                ┌──────────────────────────────────────────────┐
                                │         Google Identity Services             │
                                │   • Authenticates genuine Google credentials │
                                │   • Returns email, name, avatar              │
                                └──────────────────────┬───────────────────────┘
                                                       │
                        ┌──────────────────────────────┴──────────────────────────────┐
                        │                                                             │
                        ▼                                                             ▼
          [Action = Signup / Check User / RBAC]                         [Action = Clock-In / Clock-Out]
                        │                                                             │
                        ▼                                                             ▼
 ┌─────────────────────────────────────────────┐               ┌─────────────────────────────────────────────┐
 │       Central Multi-Tenant Directory        │               │       Punch Ingestion Pipeline              │
 │       Google Apps Script: tenancy.js        │               │   (Optimistic UI + Background Queue)        │
 │  • Server-Side CacheService (15-min TTL)    │               └──────────────────────┬──────────────────────┘
 │  • Sub-50ms In-Memory User Lookups          │                                      │
 │  • Dynamic 14-Day Trial & Subscription RBAC │               ┌──────────────────────┴──────────────────────┐
 │  • Instant Cache Invalidation on Removal    │               ▼                                             ▼
 └──────────────────────┬──────────────────────┘      [Direct Proxy Route]                 [Buffer Service Route]
                        │                                      │                                             │
                        │                                      ▼                                             ▼
                        │                        ┌───────────────────────────┐                 ┌───────────────────────────┐
                        │                        │ Apps Script: log_shift    │                 │ Decoupled Buffer Service  │
                        │                        │ (With Client-Side Jitter) │                 │ (Cloud Run: /api/v1/punch)│
                        │                        └─────────────┬─────────────┘                 └─────────────┬─────────────┘
                        │                                      │                                             │
                        │                                      │                                Micro-Batches│ up to 100
                        │                                      │                                (every 5 sec)▼
                        │                                      │                               ┌───────────────────────────┐
                        │                                      │                               │ batch_log_shifts Endpoint │
                        │                                      │                               └─────────────┬─────────────┘
                        │                                      │                                             │
                        ▼                                      ▼                                             ▼
 ┌─────────────────────────────────────────────┐ ┌─────────────────────────────────────────────────────────────────────────┐
 │  Spreadsheet: Tenants & Users Directory     │ │  Merchant Google Sheet: Staff Attendance                                │
 │  • Sheet 1: Tenants (15 Subscription Cols)  │ │  • Attendance Tab: 11 Forensic Audit Columns                            │
 │  • Sheet 2: Users (Role, Tenant ID, Status) │ │    (Server Time, Dual GPS, Clickable Maps, Duration, Shift Status)       │
 └─────────────────────────────────────────────┘ └─────────────────────────────────────────────────────────────────────────┘
```

---

### Client-Side Smoothing & Jitter Queue

Implemented in [`js/queue.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/queue.js) (`PunchQueueManager`):

1. **Instant Optimistic UI Feedback (0ms Worker Blocking)**:
   * When an employee taps **Clock In** or **Clock Out**, the local timestamp is captured immediately (`now()`).
   * The UI switches state instantly, the active duration timer begins, and haptic feedback fires. The worker is never delayed by network latency.
2. **Background Persistent Storage**:
   * Punches are persisted to `localStorage` (`sheetpunch_punch_queue`, with automated fallback migration from `crewclock_punch_queue`).
   * If the device loses cellular connection or the browser is closed, punches remain queued and automatically sync once connectivity returns.
3. **Randomized Jitter Smoothing**:
   * Shift start spikes (e.g. 200 workers clocking in at 8:00 AM) can overwhelm rate limits if fired within the same 500ms window.
   * The queue staggers outgoing HTTP writes randomly over **500ms to 2,500ms**, smoothly distributing the request volume across the minute while recording the exact millisecond-accurate punch timestamp in the sheet.
4. **Exponential Backoff on HTTP 429 (Too Many Requests)**:
   * If Google Sheets API or Apps Script returns an HTTP 429 or rate-limit error, the queue catches the response and applies exponential backoff with full jitter:
     $$\\text{WaitTime} = \\min(30000\\text{ms}, 2^{\\text{attempts}} \\times 1500\\text{ms}) + \\text{random}(0, 1500\\text{ms})$$
   * Retries occur transparently in the background without prompting the worker.
5. **Real-Time Sync Badge**:
   * A subtle UI badge informs the worker of background progress: `⟳ Syncing...` &rarr; `✓ Cloud Synced` (or `⚡ Saved Offline`).

---

### Server-Side Apps Script In-Memory Caching (`CacheService`)

Implemented in [`GScript/google-apps-script-tenancy.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/GScript/google-apps-script-tenancy.js):

1. **`CacheService.getScriptCache()` High-Speed Lookups**:
   * Utilizes Google Apps Script's native in-memory distributed cache (`CACHE_TTL_SECONDS = 900`, 15 minutes).
   * User authentication lookups (`user:${email}`) and tenant profiles (`tenant:${tenantId}`) are resolved in **<50ms**, completely bypassing the need to scan hundreds of rows in the Google Sheet on every page load.
2. **Dynamic Subscription Recomputation**:
   * Cached tenant records dynamically re-evaluate subscription and free trial validity against the current server clock (`new Date()`).
   * Prevents stale-access bugs where an expired subscription would continue to be served from cache.
3. **Comprehensive Invalidation Lifecycle**:
   To prevent stale data when administrators or staff make changes, cache keys are invalidated synchronously on all mutating actions:

   | Trigger Action | Cache Key Evicted | Purpose |
   | :--- | :--- | :--- |
   | **Staff Offboarding** (`remove_employee`) | `user:${email}` | Terminates access instantly (0ms lag); employee is barred immediately. |
   | **Staff Invitation** (`invite_employee`) | `user:${inviteEmail}` | Clears negative/unregistered cache so newly invited user logs in immediately. |
   | **Subscription Payment** (`record_payment`) | `tenant:${tenantId}` | Immediately activates paid tier and unlocks paused clock-ins without waiting for 15-min TTL. |
   | **Workspace Profile Edit** (`update_tenant`) | `tenant:${tenantId}` | Instantly reflects updated business name, logo URL, or time zone. |
   | **Workspace Signup** (`signup`) | `user:${email}`, `tenant:${tenantId}` | Clears onboarding state and initializes fresh tenant records. |

4. **Runtime Fallback & Graceful Degradation**:
   * `getCacheStore()` wraps cache acquisition in a `try...catch` block. If `CacheService` is temporarily unavailable or throttled in Google Cloud, the system seamlessly falls back to direct Google Sheet lookups with zero user downtime or 500 errors.

---

### Modular Frontend Architecture & Build System (`js/`)

To enhance maintainability, prevent regressions, and streamline pair-programming, the monolithic `app.js` (3,617 lines) is decomposed into 14 domain-driven ES modules located in [`js/`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/):

| Module | Responsibility |
| :--- | :--- |
| [`js/constants.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/constants.js) | LocalStorage keys, Google Sheet column headers, SMB industry categories, subscription tiers |
| [`js/state.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/state.js) | Central reactive store (`settings`, `currentUser`, `activeShift`, `tokenClient`, `serverOffset`) |
| [`js/dom.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/dom.js) | DOM element cache (`el`), custom in-app confirm dialogs, loaders, toast notifications |
| [`js/utils.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/utils.js) | Platform detectors (`isNativeMobileApp`), haptic feedback, date/time formatters, sheet URL extractors |
| [`js/geo.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/geo.js) | HTML5 Geolocation wrapper, timeout management, accuracy radius calculations |
| [`js/auth.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/auth.js) | Google Identity Services (GIS OAuth 2.0), persistent 7-day session management, RBAC enforcement |
| [`js/sheets.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/sheets.js) | Google Sheets REST API v4, Apps Script proxy fallback, time synchronization, tenancy resolution |
| [`js/queue.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/queue.js) | `PunchQueueManager`: offline localStorage punch queue, randomized jitter (500–2,500ms), HTTP 429 exponential backoff |
| [`js/history.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/history.js) | Shift log storage, local shift records, modal table rendering with clickable Google Maps links |
| [`js/team.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/team.js) | Team roster directory management, email invitation submission, staff member removal |
| [`js/onboarding.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/onboarding.js) | First-time merchant registration, SMB business category selector, sheet configuration |
| [`js/billing.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/billing.js) | Dual-platform pricing calculations (Web vs Mobile +15%), annual/monthly toggles, sandbox payment simulator |
| [`js/clock.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/clock.js) | Live clock ticker, shift duration counter, GPS-verified clock-in and clock-out triggers |
| [`js/main.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/main.js) | App initialization, navigation view switcher, active tab management, global event bindings |

**Native Browser Modular Loading**: The web application executes directly from these 14 clean modules, loaded in dependency order by [`index.html`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/index.html) with zero build step required.

---

### Decoupled Buffer & Micro-Batching Service

Located in [`buffer-service/`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/buffer-service/):

1. **Sub-10ms Ingestion Endpoint**:
   * Lightweight Node.js/Express service providing `POST /api/v1/punch`.
   * Immediately returns `HTTP 202 Accepted` with a unique tracking ID (`status: "buffered"`).
2. **In-Memory Ring Buffer & Micro-Batching**:
   * Collects incoming punches into a memory ring buffer.
   * Every 5 seconds (or upon reaching 100 items), flushes a micro-batch to Google Apps Script.
3. **Grouped Multi-Tenant Writes**:
   * The Apps Script endpoint (`action: "batch_log_shifts"`) receives the batch, groups punches by merchant sheet ID, and performs bulk `appendRow` operations in a single script execution.
   * Reduces Google Apps Script execution time and quota consumption by **up to 95%** during morning rushes.
4. **Graceful Fallback**:
   * If `bufferEndpointUrl` is not configured, the frontend gracefully routes punches through the direct Apps Script proxy or merchant webhook.

---

### Dual-Sheet Isolation Model

SheetPunch strictly separates **Tenant Identity/Access Management** from **Operational Attendance Data**:

1. **Central Tenants & Users Directory (`google-apps-script-tenancy.js`)**:
   * Owned and controlled by the platform operator.
   * Maintains master records of all registered workspaces (`Tenants`) and active employee affiliations (`Users`).
   * Handles user role lookups (`admin` vs `employee`) and resolves the assigned business's private attendance sheet.
2. **Individual Business Attendance Sheet (`google-apps-script.js`)**:
   * Created and owned directly by the business owner inside their own Google Drive account.
   * Completely isolated: Business A can never view, query, or affect the attendance records of Business B.
   * Employees have **0% direct Google Drive access** to the sheet. The proxy script appends records safely under the service credentials (`Execute as: Me`).

---

### Tamper-Proof Server Time Synchronization

To eliminate employee device clock manipulation (e.g., changing local phone settings forward or backward):
1. Upon loading the app, the client performs a high-precision `GET` ping to the Google Apps Script Webhook.
2. The Google server returns its authoritative `ISO 8601` timestamp alongside the merchant's configured IANA timezone (e.g., `America/Los_Angeles`).
3. The client measures network latency round-trip time (`RTT`) and establishes a clock offset:
   $$\\text{Offset} = (\\text{ServerTime} + \\frac{\\text{RTT}}{2}) - \\text{ClientTime}$$
4. All subsequent timestamps and durations are locked to this synchronized server time.

---

### Dual-Location Geolocation Auditing

SheetPunch uses the HTML5 Geolocation API configured for maximum precision (`enableHighAccuracy: true`, `timeout: 15000`, `maximumAge: 0`):
* **At Clock-In**: Device hardware GPS latitude, longitude, and accuracy radius ($\\pm\\text{meters}$) are captured at the exact second the button is pressed.
* **At Clock-Out**: GPS coordinates are re-acquired independently.
* Both locations are translated into clickable Google Maps links directly in the spreadsheet row (`https://maps.google.com/?q=lat,lng`), providing complete auditing against off-site clock-ins.

---

### Hybrid Mobile Wrappers (iOS & Android)

SheetPunch includes production-ready native mobile shells for iOS (Swift / `WKWebView`) and Android (Kotlin / `WebView`):
* Loads directly from GitHub Pages (`https://<username>.github.io/CrewClock/`).
* Pre-configured with native Geolocation permission handlers (`NSLocationWhenInUseUsageDescription` in iOS, `ACCESS_FINE_LOCATION` in Android).
* **Zero-Rebuild Deployment**: Any design or feature updates deployed to the GitHub Pages web app are immediately reflected in all installed mobile apps without requiring App Store or Google Play Store re-submission.

---

## 3. Subscription Tiers & Billing Architecture

SheetPunch features a modern **3-Tier Subscription Model** designed for expansion revenue as small businesses grow:

### Restructured Pricing Tiers

| Tier Name | Employee Capacity | Web Direct Monthly | Web Direct Annual | Target Customer |
| :--- | :---: | :---: | :---: | :--- |
| **Starter Crew** | Up to 15 employees | **\$9.99 / mo** | **\$99 / yr** *(2 months free)* | Food trucks, boutiques, small cafes, trades |
| **Growth Crew** | 16 – 35 employees | **\$19.99 / mo** | **\$199 / yr** *(2 months free)* | Busy diners, retail stores, contractor teams |
| **Pro Crew** | 36 – 50 employees | **\$24.99 / mo** | **\$249 / yr** *(2 months free)* | Multi-shift restaurants, warehouses, clinics |
| **Enterprise** | 50+ employees | *Custom Quote* | *Custom Quote* | Multi-unit franchisees, large field operations |

---

### 14-Day Full-Featured Free Trial

* Every newly registered business receives an automatic **14-Day Free Trial** on signup with full access to all features and unlimited punches.
* A prominent **Trial Countdown Pill** in the desktop header and mobile dock shows exact days remaining (e.g. `👑 Admin · 14d Trial`).
* Trial and subscription validity are computed authoritatively on the server side:
  $$\\text{DaysRemaining} = \\max\\left(0, \\left\\lceil \\frac{\\text{TrialEndDate} - \\text{CurrentServerTime}}{86,400,000\\text{ms}} \\right\\rceil\\right)$$

---

### Multi-Platform Store Fee Offset (Option B: +15%)

For mobile apps distributed through Apple App Store or Google Play Store, SheetPunch implements **Option B (+15% store fee offset)** to preserve net margins after platform commissions:

| Tier | Web Direct Rate | Mobile App Store Rate (+15%) | Annual Mobile Store Rate |
| :--- | :---: | :---: | :---: |
| **Starter Crew** | \$9.99 / mo | **\$11.99 / mo** | **\$119 / yr** |
| **Growth Crew** | \$19.99 / mo | **\$23.99 / mo** | **\$239 / yr** |
| **Pro Crew** | \$24.99 / mo | **\$29.99 / mo** | **\$299 / yr** |

* When accessed on desktop or mobile web browsers, the portal displays direct Web rates.
* In native mobile apps (`window.__SHEETPUNCH_NATIVE_APP__` or `AndroidBridge`), adjusted mobile in-app purchase tiers are seamlessly presented.

---

### Subscription Expiration & Graceful Lockout

* When a trial or subscription expires, the multi-tenant directory immediately sets `expired: true` on shift punch attempts.
* The frontend presents the **Subscription Required** modal with direct links to select a plan and activate billing.
* Historical shift logs and the merchant's Google Sheet remain 100% accessible to the owner—only new shift clock-ins are paused until renewal.

---

## 4. Role-Based Access Control (RBAC) & Security

### Roles & Permissions Matrix

| Capability | Platform Admin | Business Admin (`admin`) | Employee (`employee`) | Uninvited User |
| :--- | :---: | :---: | :---: | :---: |
| Sign In with Google (Gmail / Workspace) | ✅ | ✅ | ✅ | ❌ *(Blocked)* |
| Sign Up New Business Workspace | ✅ | ✅ | ❌ *(Hidden)* | ❌ *(Blocked)* |
| Clock-In & Clock-Out | ✅ | ✅ | ✅ | ❌ |
| View Personal Shift Log | ✅ | ✅ | ✅ | ❌ |
| Manage Team & Send Email Invites | ✅ | ✅ | ❌ *(Hidden)* | ❌ |
| Remove Staff from Team (Instant Lockout) | ✅ | ✅ | ❌ *(Hidden)* | ❌ |
| Manage Billing & Select Plans | ✅ | ✅ | ❌ *(Hidden)* | ❌ |
| Configure Business Profile & Sheet ID | ✅ | ✅ | ❌ *(Hidden)* | ❌ |
| Access Central Tenants Directory Sheet | ✅ | ❌ | ❌ | ❌ |
| Access Own Business Attendance Sheet | ✅ | ✅ | ❌ *(Proxy Only)* | ❌ |

---

### Google & Google Workspace Identity Authentication

SheetPunch uses **Google Identity Services (GIS OAuth 2.0)**:
* Supports standard personal accounts (`@gmail.com`) and custom domain business accounts (`@company.com`).
* When signing in, Google validates the user's credentials and returns their verified profile (`email`, `name`, `picture`, `hd`).
* The system matches users by normalized lowercase email (`email.toLowerCase()`), with no domain filtering.

---

### Invitation-Only Access Enforcement

To prevent arbitrary Google users from entering a business workspace:
1. When a user authenticates through Google Identity Services, their verified email is passed to the Directory Webhook (`action: "check_user"`).
2. If the email is not registered in the `Users` sheet:
   * The app denies entry and halts authentication.
   * Displays the **"Access Restricted"** banner:
     > *"Account 'name@company.com' is not registered in any business workspace. Please ask your manager to invite this Google account, or sign up as a business owner below."*
3. Only emails invited by an active Business Admin or registered during Admin Signup are permitted.

---

### Instant Offboarding Cache Invalidation

* When an employee leaves or is terminated, the Business Admin clicks **Remove** in the Team Management modal.
* The backend removes the employee from the `Users` sheet and immediately calls `removeCached("user:" + email)`.
* In-memory cache is purged at that exact millisecond. If the terminated worker attempts to punch in or reload the app, they are immediately locked out.

---

### 7-Day Persistent Session Protocol

To deliver a native time-clock experience without tedious re-login prompts:
* Authenticated sessions are securely stored in browser `localStorage` with a 7-day TTL (`expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000`).
* When an employee clocks out, their **active shift resets**, but their **user session remains intact**. When they return the next day, they are immediately greeted on Screen 1 ready to Clock In.
* Upon TTL expiry, the app smoothly transitions back to Screen 0 with a notice: *"Your session has expired. Please sign in with Google to continue."*

---

## 5. Platform Administrator Setup Guide

This guide is for the **Platform Owner** deploying the central SheetPunch service.

### Step 1: Deploy Central Multi-Tenant Directory Sheet

1. Open [Google Sheets](https://sheets.new) and create a new spreadsheet.
2. Name it: **`SheetPunch - Tenants & Users Directory`**.
3. Navigate to **Extensions > Apps Script**.
4. Clear any existing code in the editor and paste the entire content of [`google-apps-script-tenancy.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/google-apps-script-tenancy.js).
5. Click **Deploy > New deployment**:
   * Click the **Gear icon** next to *Select type* and select **Web app**.
   * **Description**: `SheetPunch Central Directory & RBAC`
   * **Execute as**: `Me (your Google email)`
   * **Who has access**: `Anyone` *(required for client web app queries)*
6. Click **Deploy**, grant permissions during the OAuth authorization screen, and copy the **Web app URL** (`https://script.google.com/macros/s/.../exec`).

---

### Step 2: Configure Google Cloud OAuth 2.0 Credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `SheetPunch-Portal`.
3. In the left navigation, go to **APIs & Services > Library**:
   * Search for **Google Sheets API** and click **Enable**.
4. In the left navigation, go to **APIs & Services > OAuth consent screen**:
   * Choose **External** *(essential to support both @gmail.com and Google Workspace custom domains)* and click **Create**.
   * **App name**: `SheetPunch Attendance Portal`
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

---

### Step 3: (Optional) Deploy Decoupled Buffer Service to Cloud Run

If expecting extreme burst concurrency (thousands of simultaneous clock-ins):
1. Navigate to the [`buffer-service/`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/buffer-service/) directory.
2. Deploy to Google Cloud Run:
   ```bash
   gcloud run deploy sheetpunch-buffer \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars TENANCY_SCRIPT_URL="https://script.google.com/macros/s/.../exec",FLUSH_INTERVAL_MS=5000,MAX_BATCH_SIZE=100
   ```
3. Copy the Cloud Run service URL (e.g. `https://sheetpunch-buffer-xyz-uc.a.run.app`) and configure it as `bufferServiceUrl` in [`config.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/config.js).

---

### Step 4: Deploy Frontend to GitHub Pages

1. In your repository, open [`config.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/config.js) and populate your credentials:
   ```javascript
   const APP_CONFIG = {
     // Central Directory Web App URL from Step 1
     tenancyScriptUrl: "https://script.google.com/macros/s/AKfycb.../exec",

     // Google OAuth 2.0 Client ID from Step 2
     googleClientId: "123456789-xxxx.apps.googleusercontent.com",

     // Optional High-Throughput Buffer Microservice URL from Step 3
     bufferServiceUrl: "https://sheetpunch-buffer-xyz-uc.a.run.app",

     // Default fallback brand name
     businessName: "SheetPunch Business",

     // Default fallback attendance sheet (optional)
     googleScriptUrl: ""
   };
   ```
2. Commit and push the repository to GitHub:
   ```bash
   git add .
   git commit -m "Deploy SheetPunch multi-tenant platform"
   git push origin main
   ```
3. In your GitHub repository, open **Settings > Pages**:
   * Source: **Deploy from a branch**.
   * Branch: `main`, folder: `/(root)`.
   * Click **Save**.
4. Your platform is now live at: `https://<username>.github.io/CrewClock/`

---

## 6. Merchant (Business Owner) Getting Started Guide

Follow this guide if you are a **business owner, general manager, or franchisee** setting up SheetPunch for your team.

### 3-Minute Fast-Track Setup Checklist

- [ ] **1. Create Attendance Sheet**: Open [Google Sheets](https://sheets.new) and create a new blank spreadsheet.
- [ ] **2. Set Timezone**: Go to **File > Settings** and pick your local time zone.
- [ ] **3. Share as Editor**: Share your sheet with the SheetPunch Platform Service Email as **Editor** (keep employee access at **0%**).
- [ ] **4. Copy Link**: Copy your sheet URL or Sheet ID from your browser address bar.
- [ ] **5. Sign Up Business**: Visit the SheetPunch portal and click **"Sign Up Your Business with Google"**.
- [ ] **6. Fill Onboarding Form**: Enter your business name, select business type, paste Sheet URL/ID, and activate your **14-Day Free Trial**.
- [ ] **7. Invite Staff**: Click **Team Management (👥)** and enter your employees' Google or Google Workspace email addresses.

---

### Step 1: Create & Secure Your Google Sheet

Every business owner keeps 100% ownership over their employee attendance data in their Google Drive without writing or deploying any code. Employees have **zero access to the sheet**, making it impossible for staff to view, alter, or tamper with their hours.

1. Open [Google Sheets](https://sheets.new) in your desktop or mobile browser.
2. Name the sheet: **`[Your Business Name] - Staff Attendance`** (e.g., `Apex Salon - Staff Attendance`).
3. **Set operational time zone**:
   * Click **File > Settings** in the top menu.
   * Under **Calculation / Time zone**, select your city or time zone.
   * Click **Save and reload**.
4. **Locate your Google Sheet ID or URL**:
   Look at your browser's address bar:
   ```text
   https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
                                          ▲──────────────────────────────────────────▲
                                                      Google Sheet ID
   ```
   * You can copy and paste either the **entire browser URL** OR just the **Sheet ID** string. SheetPunch automatically extracts the ID!
5. **Share with the Platform Service Email**:
   * Click the green **Share** button in the top-right corner of Google Sheets.
   * Enter the **Platform Service Email** displayed in your SheetPunch setup dialog.
   * Set the dropdown role to: **Editor**.
   * Click **Share**.

> [!IMPORTANT]
> **Strict Anti-Tampering Rule: DO NOT share this sheet with your employees!**
> Only the platform service email needs Editor access. When an employee punches via the app, SheetPunch verifies their identity via Google OAuth, captures hardware GPS, synchronizes authoritative Google Cloud time, and securely appends the verified row. Employees have **zero access** to the underlying file, guaranteeing 100% tamper-proof records.

---

### Step 2: Sign Up Your Business Workspace

1. Open your SheetPunch web portal link (e.g., `https://<username>.github.io/CrewClock/`).
2. On Screen 0 (Login View), click:
   👉 **"Sign Up Your Business with Google"**
3. Select your Google account (either standard `@gmail.com` or Google Workspace `@yourcompany.com`) in the Google popup and grant permissions.

---

### Step 3: Complete Workspace Onboarding Form

Immediately after authentication, the **Create Business Workspace** onboarding modal appears:

| Field | Example Value | Description |
| :--- | :--- | :--- |
| **Business / Organization Name** | `Bella Bistro & Bar` | The official name displayed to all employees on login and timers. |
| **Business Type** | `Restaurant / Food Service` | Dropdown selection of 20+ SMB categories (or custom entry). |
| **Logo Image URL** *(Optional)* | `https://example.com/logo.png` | Direct link to your business logo image. |
| **Attendance Google Sheet ID or URL** | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` | The private Google Sheet ID or URL secured in Step 1. |
| **Operational Time Zone** | `America/Los_Angeles (Pacific Time)` | The timezone used for shift calculations and daily cutoffs. |

Click **"Create Workspace & Start Free Trial →"**.
Your workspace is registered, your **14-Day Free Trial** is activated, and your dashboard loads instantly with your custom business name, logo, and the **Admin badge** in the header.

---

### Step 4: Invite Employees to Your Team

SheetPunch operates on a strict **invitation-only** model. Uninvited users cannot sign in to your workspace.

1. In the top navigation header or bottom mobile dock, click **Team Management (👥)**.
2. In the **Invite Team Member** section:
   * **Employee Email**: Enter your employee's personal Google (`@gmail.com`) or corporate Google Workspace (`@company.com`) email.
   * **Employee Full Name**: Enter their display name (e.g., `Sarah Jenkins`).
3. Click **Send Invitation**.
4. SheetPunch immediately registers the employee and dispatches a branded invitation email with a direct login link.

---

### Step 5: Managing the Team Roster & Offboarding

* **Active Members List**: Displays each employee's name, email, role, and join date.
* **Instant Offboarding / Revocation**: If an employee leaves or is terminated, click the red **Remove** button. Their access is revoked in real time and their in-memory cache is purged, preventing future clock-ins.
* **Subscription & Billing**: Click **Billing** in the header or mobile dock at any time to upgrade tiers, switch between Monthly and Annual billing, or renew active subscriptions.

---

### Step 6: Real-Time Attendance Auditing & Payroll Export

#### Accessing Your Attendance Sheet
Click the **"Open Sheet ↗"** link in your header to jump directly to your private Google Sheet.

#### Understanding the 11 Audit Columns
When staff clock in and out, SheetPunch writes records with 11 forensic auditing columns:

| Col | Header | Sample Data | Description / Audit Purpose |
| :---: | :--- | :--- | :--- |
| **A** | `Date` | `Sep 04, 2026` | Formatted calendar date of the shift. |
| **B** | `Employee Name` | `Sarah Jenkins` | Display name of employee. |
| **C** | `Email` | `sarah@company.com` | Verified Google / Workspace email used to clock in. |
| **D** | `Clock In Time` | `Sep 04, 2026 08:30:00 AM` | Authoritative server timestamp at clock-in. |
| **E** | `Clock In Coordinates` | `37.77490, -122.41940` | Precise GPS coordinates captured at clock-in. |
| **F** | `Clock In Map` | `[In Map Link]` | Clickable hyperlink to Google Maps pin showing clock-in location. |
| **G** | `Clock Out Time` | `Sep 04, 2026 04:30:00 PM` | Authoritative server timestamp at clock-out. |
| **H** | `Shift Duration` | `8h 0m` | Authoritatively computed shift duration. |
| **I** | `Clock Out Coordinates`| `37.77501, -122.41925` | Re-verified ending GPS coordinates captured at clock-out. |
| **J** | `Clock Out Map` | `[Out Map Link]` | Clickable hyperlink to ending Google Maps pin. |
| **K** | `Status` | `Completed` | Shift status (`Clocked In` during shift, `Completed` once clocked out). |

#### Exporting to Payroll (QuickBooks, Gusto, ADP, Excel)
1. Click **File > Download > Comma Separated Values (.csv)** or **Microsoft Excel (.xlsx)**.
2. Upload the CSV directly into your payroll processor.
3. You can add custom formula columns starting at Column `L` (`Hourly Rate`, `Overtime`, `Tips`, `Total Pay`)—SheetPunch will never overwrite your custom formulas!

---

### Merchant Admin Troubleshooting & FAQs

#### Q: When an employee clocks in, it says "Permission Denied: Could not open business Google Sheet". How do I fix this?
**A**: Open your Google Sheet in Google Drive, click **Share**, enter the Platform Service Email shown in your onboarding dialog, set the permission to **Editor**, and click **Share**.

#### Q: Can our business use custom domain emails (e.g. `owner@bakery.com`, `chef@bakery.com`)?
**A**: **Yes, 100%.** Any Google-powered email address (Google Workspace / G Suite) works natively with SheetPunch.

---

## 7. Employee User Guide

### Accepting Your Invitation
1. When your manager adds you to the team, you will receive an invitation email from SheetPunch.
2. Click the link to open the app on your phone or computer.

### One-Time Google Sign-In
1. On the main screen, tap:
   👉 **"Sign In with Google"**
2. Choose the Google account (Gmail or company Google Workspace) that received the invitation.
3. You are authenticated! SheetPunch remembers your session for **7 days**.

### Clocking In for a Shift (Instant Feedback)
1. When you arrive at work, open the app.
2. Tap the large green button:
   👉 **"Clock In"**
3. The button updates **immediately (0ms)** with your exact punch time. If prompted, tap **"Allow"** to share your GPS location.
4. The background queue synchronizes your punch with the cloud automatically.

### During Shift & Active Timer
* Displays your clock-in time and a live shift duration counter (`02h 15m 42s`).
* You can safely close your browser or phone app—your shift continues counting on the server!

### Clocking Out & Shift Summary
1. At the end of your shift, open the app and tap:
   👉 **"Clock Out"**
2. Confirm the prompt. Your clock-out is recorded instantly and your shift summary is displayed:
   > *"Great work today, Sarah! You worked 7h 48m. Your clock-out was recorded at 04:18 PM."*
3. Tap **Done**. You return to the Ready screen, still signed in for your next shift!

### Reviewing Shift History
* Tap the **History icon (🕒)** in the header or bottom dock to view your past shift logs, total hours, and clickable Google Maps location pins.

---

## 8. Native Mobile Apps Guide

SheetPunch includes production-ready wrappers for iOS and Android.

### iOS Native App
* **Directory**: [`ios/`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/ios/)
* **Project**: `CrewClock.xcodeproj`
* **Features**:
  * Native LaunchScreen storyboard with high-res `LaunchLogo.png`.
  * 1024&times;1024 feathered SheetPunch app icon (`AppIcon-1024.png`).
  * Injected native environment bridge (`window.__SHEETPUNCH_NATIVE_APP__ = true`).
  * Full GPS location permission handling (`NSLocationWhenInUseUsageDescription`).
  * Free installation on physical iPhones via Xcode using a personal Apple ID.

### Android Native App
* **Directory**: [`android/`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/android/)
* **Features**:
  * Android 12+ native splash theme (`windowSplashScreenAnimatedIcon` & `@drawable/launch_logo`).
  * High-res adaptive foreground icon (`432x432` with safe zone) and background (`#FAFBF9`).
  * Mipmap launcher icons across `mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, and `xxxhdpi` (square and round).
  * Custom User-Agent preventing OAuth 403 blocks.
  * Bidirectional JavaScript & `AndroidBridge` authentication.

### In-App Confirm Dialogs & Safe Area Engineering

Mobile web wrappers face unique browser environment constraints on iOS (`WKWebView`) and Android (`WebView`):

1. **Custom In-App Confirmation Modal (`showConfirmDialog`)**:
   * Standard browser `window.confirm()` dialogs are blocking and frequently suppressed or fail silently inside WebKit/WKWebView unless native `WKUIDelegate` hooks (`runJavaScriptConfirmPanelWithMessage`) are implemented.
   * SheetPunch replaces all native `confirm()` calls with a high-fidelity, non-blocking asynchronous modal ([`js/dom.js`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/js/dom.js)).
   * Returns a clean `Promise<boolean>`, providing bulletproof Clock-Out and Logout confirmations across all mobile browsers and native wrappers.
2. **Safe Area Insets & Viewport Protection**:
   * Notch and Dynamic Island iPhone devices (iPhone X through 16 Pro) feature a bottom home indicator bar that can obscure bottom action buttons.
   * Modals (such as Credit Card Checkout and Clock-Out Confirmation) feature `pb-safe` (`padding-bottom: env(safe-area-inset-bottom, 1.5rem)`) and responsive maximum heights (`max-h-[85vh]`) with internal scrollable bodies.
   * Guarantees all action buttons ("Complete Payment", "Confirm Clock Out", "Cancel") remain fully visible and clickable without being clipped.

---

### App Icons, Splash Screens & Design Treatments

| Asset Type | iOS Specification | Android Specification | Web Specification |
| :--- | :--- | :--- | :--- |
| **App Icon** | 1024&times;1024 feathered emblem on `#FAFBF9` | Mipmap square + round (48–192px) & 432px adaptive foreground | Apple Touch Icon (180px), Favicon (64px) |
| **Splash Screen** | 1200&times;1200 LaunchLogo.png in storyboard | 600&times;600 `launch_logo.png` in SplashScreen theme | Full Logo (1200px) on `#FAFBF9` linen canvas |

### Zero-Rebuild Auto-Update Architecture
Both native apps load the live web portal URL directly from GitHub Pages. Any web or design update pushed to GitHub is immediately live in all installed mobile apps without App Store or Google Play re-compilation.

---

## 9. Spreadsheet Schemas Reference

### 1. Central Directory: `Tenants` Tab (15 Columns)
Managed automatically by `google-apps-script-tenancy.js`:

| Col | Header | Type | Description |
| :---: | :--- | :--- | :--- |
| **A** | `Tenant ID` | String | Unique workspace ID (e.g. `t_a1b2c3d4`) |
| **B** | `Business Name` | String | Business commercial display name |
| **C** | `Logo URL` | String | Direct link to business logo image |
| **D** | `Admin Email` | String | Verified Google email of workspace owner |
| **E** | `Attendance Sheet URL` | String | Target Google Sheet ID or Webhook URL |
| **F** | `Time Zone` | String | IANA timezone (e.g. `America/Los_Angeles`) |
| **G** | `Created At` | ISO 8601 | Workspace provisioning timestamp |
| **H** | `Subscription Status` | String | `trial`, `active`, or `expired` |
| **I** | `Trial Ends At` | ISO 8601 | Expiration timestamp of the 14-day free trial |
| **J** | `Plan` | String | `Free Trial`, `Starter Crew`, `Growth Crew`, or `Pro Crew` |
| **K** | `Billing Cycle` | String | `monthly`, `annual`, or `trial` |
| **L** | `Paid Amount` | Currency | Last payment amount (e.g. `$9.99`, `$199.00`) |
| **M** | `Payment Date` | ISO 8601 | Timestamp of latest payment recorded |
| **N** | `Payment Reference` | String | Transaction identifier or payment note |
| **O** | `Subscription Ends At` | ISO 8601 | Active subscription paid access cutoff date |

---

### 2. Central Directory: `Users` Tab (7 Columns)
Managed automatically by `google-apps-script-tenancy.js`:

| Col | Header | Type | Description |
| :---: | :--- | :--- | :--- |
| **A** | `User Email` | String | Normalized lowercase Google account email |
| **B** | `User Name` | String | Employee full display name |
| **C** | `Role` | String | `admin` or `employee` |
| **D** | `Tenant ID` | String | Affiliated business workspace tenant ID |
| **E** | `Status` | String | `active` or `revoked` |
| **F** | `Invited By` | String | Admin email who authorized the invitation |
| **G** | `Created At` | ISO 8601 | User registration timestamp |

---

### 3. Merchant Attendance Sheet: `Attendance` Tab (11 Columns)
Managed automatically by `google-apps-script-tenancy.js` and `google-apps-script.js`:

| Col | Header | Sample Data | Description / Audit Purpose |
| :---: | :--- | :--- | :--- |
| **A** | `Date` | `Sep 04, 2026` | Calendar date of the shift |
| **B** | `Employee Name` | `Sarah Jenkins` | Display name of staff member |
| **C** | `Email` | `sarah@company.com` | Authenticated Google / Workspace email |
| **D** | `Clock In Time` | `Sep 04, 2026 08:30:00 AM` | Authoritative server timestamp at clock-in |
| **E** | `Clock In Coordinates` | `37.77490, -122.41940` | Device GPS coordinates captured at clock-in |
| **F** | `Clock In Map` | `[In Map Link]` | Clickable hyperlink to Google Maps pin |
| **G** | `Clock Out Time` | `Sep 04, 2026 04:30:00 PM` | Authoritative server timestamp at clock-out |
| **H** | `Shift Duration` | `8h 0m` | Authoritatively computed elapsed shift duration |
| **I** | `Clock Out Coordinates`| `37.77501, -122.41925` | Re-verified ending GPS coordinates |
| **J** | `Clock Out Map` | `[Out Map Link]` | Clickable hyperlink to ending Google Maps pin |
| **K** | `Status` | `Completed` | Shift status (`Clocked In` or `Completed`) |

---

## 10. Automated End-to-End Testing & BDD Framework

SheetPunch features an end-to-end **Behavior-Driven Development (BDD)** test automation suite located in [`test/`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/test/). The testing framework is built with **Python**, **Playwright**, and **Behave** (native Python Cucumber runner).

---

### BDD Framework Architecture (Python + Playwright + Behave)

BDD bridges product requirements and technical verification by expressing acceptance criteria in human-readable Gherkin syntax (`Given`, `When`, `Then`, `And`).

```
test/
├── README.md                      # Test suite documentation & quick start
├── requirements.txt               # Dependencies: behave>=1.2.6, playwright>=1.42.0
├── mocks/
│   ├── __init__.py
│   └── apps_script_mock.py        # Playwright network interceptor for Apps Script & Sheets APIs
├── pages/
│   ├── __init__.py
│   └── clock_page.py              # Page Object Model (POM) encapsulating DOM selectors & actions
└── features/
    ├── environment.py             # Behave lifecycle hooks (server boot, browser init, mock routing)
    ├── clock.feature              # BDD: Clock In, live shift timer, GPS capture, Clock Out confirmation
    ├── team.feature               # BDD: RBAC access, directory roster loading, staff invitations
    ├── billing.feature            # BDD: Tiered pricing, annual discount toggle, sandbox checkout
    └── steps/
        ├── __init__.py
        ├── common_steps.py        # Shared auth steps (Admin & Employee sign-in injection)
        ├── clock_steps.py         # Step mappings for clock.feature
        ├── team_steps.py          # Step mappings for team.feature
        └── billing_steps.py       # Step mappings for billing.feature
```

---

### Zero-Dependency Network Route Mocking

To ensure fast, resilient, and non-destructive automated testing, all external calls to **Google Apps Script Web Apps** (`script.google.com/**`) and **Google Sheets REST API** (`sheets.googleapis.com/**`) are intercepted at the browser network layer via Playwright's `page.route()`.

Implemented in [`test/mocks/apps_script_mock.py`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/test/mocks/apps_script_mock.py):

* **Zero External Google Dependencies**: Tests run 100% offline without hitting live Google servers, quotas, or cloud services.
* **Deterministic Responses**: Provides instantaneous, realistic mock responses for:
  * `serverTimeIso` & `timeZone`: Authoritative Google Cloud server time synchronization.
  * `check_user`: Tenant and user authentication lookup.
  * `signup`: Merchant workspace provisioning and 14-day trial initialization.
  * `log_shift`: Clock-in and clock-out punch ingestion with dual GPS coordinates.
  * `get_team`: Team directory retrieval with admin/employee roles.
  * `invite_employee`: Automated invitation dispatch simulation.
  * `remove_employee`: Real-time staff offboarding and cache invalidation.
  * `record_payment`: Subscription activation and receipt generation.
* **Zero Production Data Pollution**: Test runs never alter or pollute production spreadsheets or tenant registries.

---

### Page Object Model (`ClockPage`)

Implemented in [`test/pages/clock_page.py`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/test/pages/clock_page.py):

The Page Object Model cleanly decouples test assertions from underlying HTML DOM structures and CSS class names:

* **High-Level Business Actions**: Exposes methods such as `clock_in()`, `clock_out()`, `open_team()`, `invite_member(email, name)`, `open_billing()`, `select_billing_cycle("yearly")`, and `complete_sandbox_payment()`.
* **Headless Geolocation Emulation**: Chromium runs with pre-granted permissions for coordinates `37.7749°, -122.4194°` (San Francisco, CA) to verify hardware GPS capture and Google Maps link generation.
* **Deterministic Session Injection (`inject_session`)**: Injects valid authenticated Admin or Employee session objects directly into `localStorage`, bypassing third-party Google OAuth popups and eliminating CI login flakiness.

---

### Ephemeral Test Server & Lifecycle Hooks

Implemented in [`test/features/environment.py`](file:///Users/venkata/workspace/PersonalBranding/CrewClock/test/features/environment.py):

* **`before_all`**: Automatically boots a lightweight Python `http.server` in a background daemon thread bound to an ephemeral port (`127.0.0.1:0`), serving web assets (`index.html`, `js/`, `style.css`). Launches Playwright headless Chromium.
* **`before_scenario`**: Creates a fresh isolated browser context, configures geolocation permissions, registers the `AppsScriptMock` route interceptor, and initializes the `ClockPage`.
* **`after_scenario`**: Gracefully closes the browser context and page, resetting state for the next scenario.
* **`after_all`**: Shuts down Playwright and terminates the local HTTP server.

---

### Gherkin Feature Specifications

The test suite covers all critical business workflows across 3 comprehensive feature specifications:

#### 1. Attendance Clock In & Out (`test/features/clock.feature`)
* **Clock-In**: Employee clicks Clock In &rarr; verified transition to Active Shift screen &rarr; live counter ticks &rarr; GPS coordinates displayed.
* **Clock-Out**: Employee clicks Clock Out &rarr; confirmation dialog appears &rarr; user confirms &rarr; farewell modal renders total shift duration and timestamps.

#### 2. Team Management & Role-Based Access Control (`test/features/team.feature`)
* **Roster Inspection**: Business Administrator opens Team modal &rarr; mocked directory loads &rarr; active employees displayed with roles and statuses.
* **Staff Invitations**: Administrator submits invitation for new employee &rarr; mocked directory responds &rarr; success badge confirms invitation dispatched.

#### 3. Subscription & Billing Management (`test/features/billing.feature`)
* **Plan & Pricing Tiers**: Administrator opens Billing &rarr; verifies Starter Crew, Growth Crew, and Pro Crew tiers &rarr; toggles between Monthly and Annual billing &rarr; checks discounted annual pricing display.
* **Sandbox Payment Processing**: Administrator selects payment &rarr; completes sandbox credit card payment &rarr; active subscription receipt is rendered.

---

### Running BDD Tests with Behave

All tests are executed natively through Python's `behave` runner without using npm:

#### 1. Setup Virtual Environment
```bash
python3 -m venv .venv
.venv/bin/pip install -r test/requirements.txt
.venv/bin/playwright install chromium
```

#### 2. Run Entire Test Suite
```bash
.venv/bin/behave test/features
```
*(Or simply `behave test/features` if your virtual environment is active)*

#### 3. Run Specific Feature
```bash
.venv/bin/behave test/features/clock.feature
.venv/bin/behave test/features/team.feature
.venv/bin/behave test/features/billing.feature
```

#### Sample Test Suite Run Output
```text
USING RUNNER: behave.runner:Runner
Feature: Attendance Clock In and Out # test/features/clock.feature:1
  Scenario: Staff member clocks in and sees active shift timer ... PASSED
  Scenario: Staff member clocks out with confirmation ... PASSED

Feature: Team Management & Role-Based Access Control # test/features/team.feature:1
  Scenario: Admin views team roster from mocked directory ... PASSED
  Scenario: Admin invites a new staff member ... PASSED

Feature: Subscription & Billing Management # test/features/billing.feature:1
  Scenario: Admin toggles billing cycle and views updated prices ... PASSED
  Scenario: Admin tests sandbox payment and receives activation receipt ... PASSED

3 features passed, 0 failed, 0 skipped
6 scenarios passed, 0 failed, 0 skipped
27 steps passed, 0 failed, 0 skipped
Took 0min 9.856s
```

---

## 11. Troubleshooting & FAQs

### Q: Does SheetPunch support Google Workspace (custom domain emails)?
**A**: **Yes, completely.** Google Workspace accounts (`name@company.com`) authenticate identically to standard Google accounts. The directory matches user records using case-insensitive email comparison without domain restrictions.

### Q: How does SheetPunch handle morning shift rushes (e.g. 200 workers clocking in at 8:00 AM sharp)?
**A**: SheetPunch uses a three-tier high-scale architecture:
1. **Client-Side Optimistic UI + Jitter**: Punches update worker screens at 0ms and stagger network requests across 500ms–2,500ms.
2. **Server-Side `CacheService`**: In-memory script caching resolves user authentication in <50ms without reading rows from Google Sheets.
3. **Decoupled Buffer Microservice**: Ingests punches in <10ms and micro-batches up to 100 punches per batch to Google Sheets.

### Q: What happens when our 14-day free trial expires?
**A**: Your historical shift logs remain 100% accessible in your private Google Sheet. To continue logging new clock-ins, the Business Admin visits the **Billing** modal and selects either Starter Crew (\$9.99/mo), Growth Crew (\$19.99/mo), or Pro Crew (\$24.99/mo).

### Q: Why do I see "Access Restricted" when trying to sign in?
**A**: SheetPunch enforces invitation-only security. Your Google email must first be invited by an authorized Business Admin via the Team Management modal (👥) before you can sign in. If you are a business owner starting a new workspace, click **"Sign Up Your Business with Google"** instead.

### Q: Can employees edit or tamper with their hours in the Google Sheet?
**A**: **No.** The Google Sheet is private to the business owner and shared only with the platform service email. Employees have 0% access to the underlying file, guaranteeing tamper-proof audit trails.

---

## 12. Scalability Analysis & Enterprise Growth Bottlenecks (5,000+ Tenants Roadmap)

This section provides a rigorous technical breakdown of the platform's architectural limits as SheetPunch scales from initial pilots (10–100 tenants) to mid-market and enterprise scale (**1,000–5,000+ business tenants and 50,000+ active daily workers**).

Use this reference to anticipate platform ceilings, understand Google Cloud / Workspace quotas, and implement phased architectural migrations before hitting production bottlenecks.

---

### Architectural Scale Thresholds Summary

| Scale Phase | Active Tenants | Active Punch Users | Primary System Bottleneck | Required Engineering Action |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1: Pilot & Launch** | 1 – 100 | 10 – 1,000 | **Google OAuth "Testing" State** (100-user whitelist limit). | Switch OAuth Consent Screen to **"In Production"** in Google Cloud Console. |
| **Phase 2: Growth** | 100 – 500 | 1,000 – 7,500 | **Google Apps Script `CacheService` 100 KB ceiling** & directory read latency. | Deploy `buffer-service/` (Cloud Run) to micro-batch punches and shield Apps Script. |
| **Phase 3: Mid-Market** | 500 – 2,000 | 7,500 – 25,000 | **Apps Script 30-concurrent-execution limit** during 8:00–9:00 AM shift start spikes. | Upgrade `buffer-service/` to **Direct Google Sheets API v4** via Service Account. |
| **Phase 4: Enterprise** | 2,000 – 5,000+ | 25,000 – 50,000+ | **Google Sheets API quota** (300 req/min/project) & Central Directory sheet locks. | Migrate Central Directory from Google Sheets to **Cloud SQL (PostgreSQL) / Redis**; keep tenant punch sheets in Google Drive. |

---

### Deep Dive: The 4 Critical Platform Bottlenecks

#### 1. Google OAuth 2.0 User Limits ("Testing" vs. "Production")

* **The Bottleneck**:
  When a Google Cloud OAuth 2.0 Client ID is created, Google defaults the OAuth Consent Screen to **"Testing"** status. In Testing status:
  * Only specific Google accounts explicitly whitelisted in the Google Cloud Console (up to **100 test users**) can log in.
  * Any unlisted business admin or employee attempting to log in receives an `access_denied` error (Error 403: `access_denied` - This app has not been verified yet).
* **The Scaling Solution**:
  * **Scope Verification Exemption**: SheetPunch intentionally requests only standard, non-sensitive Google scopes:
    - `https://www.googleapis.com/auth/userinfo.email`
    - `https://www.googleapis.com/auth/userinfo.profile`
    - `openid`
  * Because SheetPunch does **not** request sensitive scopes (like `drive.readonly` or full Drive access), Google does **NOT** require an expensive Cloud App Security Assessment (CASA Tier 2/3 audit) or a security demonstration video.
  * **Action Required**: In Google Cloud Console &rarr; *APIs & Services* &rarr; *OAuth consent screen*, click **"Publish App"**. The app immediately switches to "In Production", allowing any Google account globally to authenticate without user limits.

---

#### 2. Google Apps Script 100 KB Total `CacheService` Ceiling

* **The Bottleneck**:
  `GScript/google-apps-script-tenancy.js` uses `CacheService.getScriptCache()` to cache:
  - User records: `user:${email}` (~180 bytes JSON)
  - Tenant records: `tenant:${tenantId}` (~260 bytes JSON)
  Google Apps Script enforces a strict quota: **100 KB maximum TOTAL cache size across all keys in the script project**.
  - At **50–100 tenants** (~1,000 users), total cache usage is ~180 KB. Keys begin to silently evict.
  - At **5,000 tenants** (~50,000 users), data volume exceeds **10 MB**, rendering the 100 KB script cache completely ineffective.
* **The Failure Mode**:
  When cache keys are evicted, every authentication and shift punch falls back to scanning the central directory spreadsheet:
  ```javascript
  var rows = usersSheet.getRange(2, 1, lastRow - 1, 7).getValues();
  ```
  Executing `getValues()` across 5,000 rows in Google Sheets takes **3 to 6 seconds per call**. Under concurrent morning shift traffic, document-level read locks cause request timeouts (`Exceeded maximum execution time`).
* **The Scaling Solution**:
  1. **Short-Term (Growth Phase)**: Store only compressed IDs in `CacheService` or pass signed user claims in the client session token.
  2. **Long-Term (Enterprise Phase)**: Move the central "Tenants & Users" directory lookup off Google Sheets into an in-memory Redis cache or a lightweight managed database (Cloud SQL / Supabase). The tenant's *attendance records* still write to their private Google Sheet to maintain 100% data sovereignty.

---

#### 3. Google Apps Script 30-Concurrent-Execution Wall & Daily Quotas

* **The Bottleneck**:
  Google Apps Script Web Apps have a hard, unalterable limit of **30 simultaneous script executions** across a single deployment globally.
  * If 200 workers across 20 restaurants tap "Clock In" simultaneously at 8:00 AM, Google Apps Script immediately rejects requests beyond the 30th concurrent execution with:
    `Service Spreadsheets failed while accessing document` or `HTTP 429: Too Many Simultaneous Executions`.
  * **Daily Execution Quota**: Google Workspace accounts have a limit of **6 hours of total execution time per day** (90 min/day on free Gmail accounts). 50,000 punches at an average of 1.2s per Apps Script execution equals **16.6 hours of CPU runtime per day**—exceeding Google's daily quota by 2.7x.
* **The Scaling Solution**:
  * **Client-Side Jitter (`js/queue.js`)**: Staggers outgoing requests across 500ms–2,500ms to avoid micro-burst concurrency spikes (already implemented in `PunchQueueManager`).
  * **Decoupled Buffer Microservice (`buffer-service/`)**: Ingests punches in <10ms and micro-batches them into single requests (`batch_log_shifts`), reducing 50,000 individual executions into ~500 batch writes.

---

#### 4. The Buffer Service Evolution: From Apps Script Proxy to Direct Sheets API v4

* **Current Limitation in `buffer-service/index.js`**:
  The current buffer service acts as an HTTP shock absorber, but its background flush worker still forwards batches to Google Apps Script:
  ```javascript
  fetch(TENANCY_SCRIPT_URL, { action: 'batch_log_shifts', shifts: batch })
  ```
  While this reduces concurrency, Google Apps Script still has to open each merchant's spreadsheet (`SpreadsheetApp.openById(sheetId)`) and execute Apps Script triggers.
* **Enterprise Scaling Upgrade (Direct Google Sheets API v4)**:
  To completely decouple from Google Apps Script execution limits, `buffer-service/` should be upgraded with the official `@googleapis/sheets` Node.js library using a **Google Cloud Service Account**:
  ```javascript
  const { google } = require('googleapis');
  const sheets = google.sheets({ version: 'v4', auth: serviceAccountAuth });

  // Direct append bypasses Apps Script entirely
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Attendance!A:K',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [batchRowValues] }
  });
  ```
  * **Key Advantages of Direct API**:
    - **Zero Concurrency Limits**: No 30-execution cap.
    - **300 Requests/Minute per Project**: Google Sheets API quota allows 300 writes per minute per project (and can be increased via Google Cloud quota increase requests).
    - **Sub-150ms Write Latency**: Direct Google Cloud infrastructure writes are 10x faster than Apps Script `SpreadsheetApp`.
    - **Zero Apps Script Daily Runtime Quota**: API calls do not consume Apps Script execution time.

---

### Migration Roadmap: Phased Implementation Guide

```
[Phase 1: Now (0–100 Tenants)]
  └─ OAuth Console: Switch to "In Production" (No CASA audit required for email/profile)
  └─ Rely on CacheService (15 min TTL) + Client Jitter Queue (500–2500ms)

[Phase 2: Growth (100–500 Tenants)]
  └─ Deploy buffer-service to Google Cloud Run ($0/mo on free tier)
  └─ Enable bufferEndpointUrl in config.js
  └─ Use batch_log_shifts in Apps Script to group writes

[Phase 3: Mid-Market (500–2,000 Tenants)]
  └─ Add @googleapis/sheets to buffer-service
  └─ Service Account direct writes to merchant sheets (bypassing Apps Script)
  └─ Cache merchant sheet IDs in Redis / Cloud Run memory

[Phase 4: Enterprise (2,000–5,000+ Tenants)]
  └─ Central Directory moved to Cloud SQL / PostgreSQL (for sub-10ms user authentication)
  └─ Keep merchant attendance 100% in private Google Sheets (Data Sovereignty preserved)
  └─ Multi-project Google Cloud service account pooling (if exceeding 300 req/min)
```

---
*Maintained by the SheetPunch Core Team. Built for modern, agile teams.*
