# 📱 SheetPunch - Native iOS Application

A high-performance native iOS application for **SheetPunch** built with Swift, SwiftUI, and WebKit (`WKWebView`). It wraps your live hosted web app at `https://naninice2000.github.io/CrewClock/iGrill/`, providing a complete native app experience while ensuring **any changes pushed to your GitHub repository appear immediately in the iOS app without needing App Store re-submission or app updates**.

---

## 🚀 Key Native Capabilities

1. **Auto-Update Guarantee**:
   - The app loads directly from your GitHub Pages deployment.
   - Any commit & push to your GitHub repository is instantly available to employees on their next app launch or pull-to-refresh. Zero app updates required!

2. **GPS Geolocation Support**:
   - Configured with `NSLocationWhenInUseUsageDescription` in `Info.plist` and native CoreLocation permission requests.
   - When employees tap "Clock In", the device prompts for GPS location access so high-accuracy coordinates are recorded to your Google Sheet.

3. **Google Sign-In Popup Support**:
   - Configured with a clean Mobile Safari User-Agent to satisfy Google Identity Services.
   - `WKUIDelegate` captures Google's popup account chooser (`window.open`) and presents it inside a native modal navigation controller with a "Cancel" button, auto-closing upon authentication.

4. **Native Pull-to-Refresh (`UIRefreshControl`)**:
   - Custom amber spinner (`#D97706`) allowing staff or managers to pull down and force-refresh the app anytime.

5. **Network Connectivity Monitoring (`NWPathMonitor`)**:
   - Monitors cellular/Wi-Fi connection. If offline, presents a clean native error view with a "Try Again" button.

---

## 🛠️ Project Structure

```
iGrill/ios/
├── CrewClock.xcodeproj/
│   └── project.pbxproj            # Xcode project configuration
├── CrewClock/
│   ├── App/
│   │   └── CrewClockApp.swift     # SwiftUI @main entry point
│   ├── Views/
│   │   ├── ContentView.swift      # Main container with top progress bar
│   │   ├── WebViewContainer.swift # WKWebView + UIRefreshControl + Google OAuth popup handler
│   │   └── OfflineView.swift      # Native offline error screen with retry
│   ├── Services/
│   │   ├── LocationManager.swift  # CoreLocation permission coordinator
│   │   ├── NetworkMonitor.swift   # Real-time NWPathMonitor network listener
│   │   └── WebViewModel.swift     # ObservableObject for progress & navigation states
│   ├── Config/
│   │   └── AppConfig.swift        # Central configuration (Hosted URL, Amber theme)
│   └── Resources/
│       ├── Assets.xcassets/       # AppIcon & AccentColor (#D97706)
│       ├── Info.plist             # App metadata & Geolocation permissions (arm64)
│       └── LaunchScreen.storyboard# Warm amber launch screen
└── README.md                      # This guide
```

---

## 🔨 How to Build the iOS App

### Method 1: Build via Terminal (Command Line)

To test compilation for a physical device or simulator without opening Xcode:

**For Physical iPhone (`arm64`):**
```bash
xcodebuild -project iGrill/ios/CrewClock.xcodeproj -scheme CrewClock -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

**For iOS Simulator:**
```bash
xcodebuild -project iGrill/ios/CrewClock.xcodeproj -scheme CrewClock -destination 'generic/platform=iOS Simulator' build
```

---

## 📲 How to Install onto Your Physical Dev iPhone (100% Free)

You can install SheetPunch directly onto your personal or development iPhone using Xcode with a free personal Apple ID:

### Step 1: Connect Your iPhone
1. Connect your iPhone to your Mac using a USB cable.
2. Unlock your iPhone and tap **"Trust This Computer"** (enter your iPhone passcode if prompted).

### Step 2: Enable "Developer Mode" on iPhone (iOS 16, 17, 18+)
Apple requires Developer Mode to be enabled to run sideloaded apps on modern iOS:
1. On your iPhone, open **Settings > Privacy & Security**.
2. Scroll to the bottom and tap **Developer Mode**.
3. Toggle Developer Mode to **On**.
4. Your iPhone will prompt you to **Restart**.
5. After rebooting and unlocking, tap **Turn On** and enter your passcode.

### Step 3: Open the Project in Xcode
Run the following command in terminal or double-click `CrewClock.xcodeproj` in Finder:
```bash
open iGrill/ios/CrewClock.xcodeproj
```

### Step 4: Configure Free Code Signing
1. In Xcode's left sidebar, click the top blue **CrewClock** project root.
2. Under the **TARGETS** section, select **CrewClock**.
3. Click the **Signing & Capabilities** tab.
4. Check **Automatically manage signing**.
5. Under **Team**, select your name (Personal Team). *(If none is listed, click "Add an Account..." and log in with your normal Apple ID free account)*.
6. In **Bundle Identifier**, if you get a conflict error, change `com.venkataduggirala.crewclock` to a unique name (e.g. `com.<yourname>.crewclock`).

### Step 5: Build & Install to Dev Phone
1. At the top of the Xcode window, click on the device selector (next to the **CrewClock** scheme).
2. Select your connected physical iPhone from the list under **iOS Devices**.
3. Click the **Run (▶️)** button or press `⌘ + R`.
4. Xcode will compile, package, sign, install the app onto your iPhone, and launch it automatically.

### Step 6: Trust the Certificate on iPhone (First Time Only)
When the app installs for the first time, iOS prevents opening untrusted developer certificates:
1. On your iPhone, go to **Settings > General > VPN & Device Management**.
2. Under **Developer App**, tap your Apple ID email.
3. Tap **Trust "[Your Apple ID]"** and confirm **Trust**.
4. Now tap the **SheetPunch** icon on your home screen to use the app!

---

## 💻 How to Run in iOS Simulator

1. Open `iGrill/ios/CrewClock.xcodeproj` in Xcode.
2. In the top device selector, choose any iPhone simulator (e.g., **iPhone 16 Pro** or **iPhone 17**).
3. Click **Run (▶️)** or press `⌘ + R`.
4. The simulator will boot, install, and launch **SheetPunch**.
