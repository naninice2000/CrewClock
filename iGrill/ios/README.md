# 📱 CrewClock - Native iOS Application

A high-performance native iOS application for **CrewClock** built with Swift, SwiftUI, and WebKit (`WKWebView`). It wraps your live hosted web app at `https://naninice2000.github.io/CrewClock/iGrill/`, providing a complete native app experience while ensuring **any changes pushed to your GitHub repository appear immediately in the iOS app without needing App Store re-submission or app updates**.

---

## 🚀 Key Native Capabilities

1. **Auto-Update Guarantee**:
   - The app loads directly from your GitHub Pages deployment.
   - Any commit & push to your GitHub repository is instantly available to employees on their next app launch or pull-to-refresh. Zero app updates required!

2. **GPS Geolocation Support**:
   - Includes `NSLocationWhenInUseUsageDescription` in `Info.plist` and native CoreLocation permission requests.
   - When employees tap "Clock In", the device prompts for GPS location access so high-accuracy coordinates are recorded to your Google Sheet.

3. **Google Sign-In Popup Support**:
   - Configured with a clean Mobile Safari User-Agent to satisfy Google Identity Services.
   - `WKUIDelegate` captures Google's popup account chooser (`window.open`) and presents it inside a native modal navigation controller with a "Cancel" button, auto-closing upon authentication.

4. **Native Pull-to-Refresh (`UIRefreshControl`)**:
   - Custom amber spinner (`#d97706`) allowing staff or managers to pull down and force-refresh the app anytime.

5. **Network Connectivity Monitoring (`NWPathMonitor`)**:
   - Monitors cellular/Wi-Fi connection. If offline, presents a clean native error view with a "Try Again" button.

---

## 🛠️ Project Structure

```
ios/
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
│       ├── Assets.xcassets/       # AppIcon & AccentColor (#d97706)
│       ├── Info.plist             # App metadata & Geolocation permissions
│       └── LaunchScreen.storyboard# Warm amber launch screen
└── README.md                      # This guide
```

---

## 💻 How to Run in iOS Simulator

1. Open **Xcode** on your Mac.
2. Select **Open Existing Project** and choose the `ios/CrewClock.xcodeproj` file.
3. In the top device selector, choose any iPhone simulator (e.g., **iPhone 15 Pro** or **iPhone 16**).
4. Click the **Run (▶️)** button or press `⌘ + R`.
5. The simulator will boot, install, and launch **CrewClock**!

---

## 📲 How to Install onto Your Physical iPhone (Free)

You can install CrewClock directly onto your iPhone without a paid Apple Developer account:

1. **Connect Your iPhone**:
   - Connect your iPhone to your Mac using a USB-C or Lightning cable.
   - Unlock your iPhone and tap **"Trust This Computer"** if prompted.
2. **Open the Project in Xcode**:
   - Open `ios/CrewClock.xcodeproj`.
3. **Configure Code Signing**:
   - Click the top-level **CrewClock** project icon in Xcode's left sidebar.
   - Select the **CrewClock** target under *Targets*.
   - Click the **Signing & Capabilities** tab.
   - Check **"Automatically manage signing"**.
   - Under **Team**, choose your Personal Apple ID (click *Add an Account...* if you haven't signed in yet).
   - In **Bundle Identifier**, change `com.venkataduggirala.crewclock` to a unique identifier if needed (e.g. `com.yourname.crewclock`).
4. **Run on Device**:
   - In the top device selector, choose your connected iPhone.
   - Press **Run (▶️)** (or `⌘ + R`).
5. **Trust the Certificate on Your iPhone (First Time Only)**:
   - On your iPhone, go to **Settings > General > VPN & Device Management**.
   - Under *Developer App*, tap your Apple ID and select **"Trust"**.
   - CrewClock will now open from your iPhone home screen!
