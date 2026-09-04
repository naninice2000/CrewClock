# Restaurant Staff Attendance & Time Clock Web App

A 100% serverless Employee Clock-In & Attendance Web App hosted directly on **GitHub Pages**, combining **Google Gmail Authentication** with **Google Apps Script** for automatic, secure logging to a **Google Sheet**.

---

## Architecture: Why Google Apps Script is Better

```
[Employee Phone on GitHub Pages]
   │
   ├─► 1. "Clock In with Google"
   │      └─ Google Identity Services (GIS OAuth 2.0 Popup)
   │      └─ Authenticates genuine Gmail identity (email, name, photo)
   │      └─ NO scary Google Drive permissions!
   │
   ├─► 2. Browser Geolocation API
   │      └─ Captures high-accuracy GPS coordinates & accuracy radius
   │
   └─► 3. Google Apps Script Web App (Connected to Google Sheet)
          ├─ Clock In: POST /exec { action: "clockin", email, name, lat, lng, timestamp }
          │    └─ Appends row: [Email, Name, ClockIn, Location, Maps Link, (Empty), Status]
          └─ Clock Out: POST /exec { action: "clockout", email, timestamp }
               └─ Locates active shift & updates Clock-Out time in the EXACT SAME ROW
```

### Key Advantages:
1. **Generous Quotas**: Google Apps Script provides **20,000+ executions per day** for free (no daily API limits to worry about).
2. **Employee Privacy**: Staff only verify their identity (Gmail address and name). They are never asked to give permission to edit files in their personal Google Drive.
3. **Tamper-Proof**: Employees do not have edit access to your spreadsheet. The script runs as the owner and securely appends/updates records.

---

## Google Sheet Layout

Each shift is recorded as a single row:

| Col A: Email | Col B: Employee Name | Col C: Clock-In Time | Col D: Location (Lat, Lng) | Col E: Accuracy | Col F: Google Maps Link | Col G: Clock-Out Time | Col H: Shift Duration | Col I: Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `alex@gmail.com` | `Alex Rivera` | `09/04/2026 08:30 AM` | `37.7749, -122.4194` | `6 m` | `[Map Link]` | `09/04/2026 04:30 PM` | `8h 0m` | `Completed` |

---

## 2-Minute Google Sheet & Apps Script Setup

1. Open [sheets.new](https://sheets.new) to create a new Google Sheet.
2. In the top menu, click **Extensions > Apps Script**.
3. Delete any code in the editor and paste the entire contents of [`google-apps-script.js`](google-apps-script.js).
4. Click the blue **Deploy** button (top right) > **New deployment**.
5. Click the gear icon next to "Select type" and choose **Web app**:
   - **Description**: `Employee Clock-In Webhook`
   - **Execute as**: `Me (your email)`
   - **Who has access**: `Anyone` *(required so the web app can submit clock-ins)*
6. Click **Deploy**, click **Authorize access**, and copy your **Web app URL** (looks like `https://script.google.com/macros/s/.../exec`).
7. Paste this URL into [`config.js`](config.js) under `googleScriptUrl` (or in the in-app **⚙️ Settings**).

---

## Google Cloud Setup (OAuth 2.0 Web Client ID)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Staff-ClockIn`).
3. Under **APIs & Services > OAuth consent screen**:
   - User Type: **External**
   - App Name: `Staff Time Clock`
   - Scopes: Just the default `userinfo.email` and `userinfo.profile` (no sensitive Drive scopes!).
   - Under **Test users**, add your Gmail address and staff emails.
4. Under **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth client ID**.
   - Application Type: **Web application**.
   - **Authorized JavaScript origins**:
     - `http://localhost:8000` (for local testing)
     - `https://<your-github-username>.github.io` (for GitHub Pages)
   - Click **Create** and copy your **Client ID** (`123456789-xxx.apps.googleusercontent.com`).
5. Paste your **Client ID** into [`config.js`](config.js) under `googleClientId`.

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
