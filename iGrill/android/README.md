# 🤖 SheetPunch - Native Android Application

A high-performance native Android application for **SheetPunch** built with Kotlin, Android Jetpack, and `WebView`. It wraps your live hosted web app at `https://naninice2000.github.io/CrewClock/iGrill/`, providing a complete native app experience while ensuring **any changes pushed to your GitHub repository appear immediately in the Android app without needing Google Play re-submission or APK updates**.

---

## 🚀 Key Native Capabilities

1. **Auto-Update Guarantee**:
   - The app loads directly from your GitHub Pages deployment.
   - Any commit & push to your GitHub repository is instantly available to employees on their next app launch or pull-to-refresh. Zero APK updates required!

2. **Hardware GPS Geolocation Bridging**:
   - Declares `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` in `AndroidManifest.xml`.
   - Bridges HTML5 Geolocation requests through `WebChromeClient.onGeolocationPermissionsShowPrompt()` with native Android runtime permission prompts.
   - When employees tap "Clock In", the device prompts for GPS location access so high-accuracy coordinates are recorded to your Google Sheet.

3. **Google Sign-In 403 Disallowed User-Agent Fix**:
   - Google blocks standard Android WebViews from OAuth (`403: disallowed_useragent`).
   - The app automatically sanitizes the User-Agent string at startup by stripping the `; wv` and `Version/4.0` WebView tags, rendering the WebView indistinguishable from mobile Google Chrome and enabling seamless Google Identity authentication.

4. **Native Pull-to-Refresh (`SwipeRefreshLayout`)**:
   - Custom amber spinner (`#D97706`) allowing staff or managers to pull down and force-refresh the app anytime.

5. **Network Connectivity Monitoring**:
   - Uses `ConnectivityManager` to monitor cellular/Wi-Fi connection. If offline, presents a clean native error view with a "Try Again" button.

6. **Native Edge-to-Edge System Bar Integration**:
   - Integrated with Android 14/15 edge-to-edge system bars, dynamic window insets, Material 3 theming, and an indeterminate top loading indicator.

---

## 🔨 How to Build the APK (When Ready)

You can compile the Android application whenever you are ready using the Gradle wrapper or Android Studio:

### Command Line:
```bash
cd iGrill/android
./gradlew assembleDebug
```

Once built, the APK will be generated at:
```
iGrill/android/app/build/outputs/apk/debug/app-debug.apk
```

### Android Studio:
1. Open the `iGrill/android` folder in **Android Studio**.
2. Select **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

---

## 📲 How to Install onto Your Physical Android Phone (After Building)

### Option A: Install via ADB (Fastest via USB)
1. Enable **Developer Options** and **USB Debugging** on your Android phone.
2. Connect your phone to your computer via USB.
3. Run:
   ```bash
   adb install -r iGrill/android/app/build/outputs/apk/debug/app-debug.apk
   ```
4. The app will appear on your home screen and app drawer under **SheetPunch** with an amber clock icon.

### Option B: Direct Sideloading (No computer needed after copying)
1. Copy `app-debug.apk` to Google Drive, WhatsApp, Slack, or send it via email to yourself.
2. Open the file on your Android phone.
3. Tap **Install** (if prompted, allow installing apps from this source).
4. Launch **SheetPunch**!


---

## 🛠️ Project Structure

```
android/
├── app/
│   ├── build.gradle.kts           # App-level dependencies & build configuration (SDK 34)
│   ├── src/main/
│   │   ├── AndroidManifest.xml    # App manifest, permissions (GPS, Internet)
│   │   ├── java/com/crewclock/app/
│   │   │   ├── MainActivity.kt               # Main activity (WebView, Pull-to-refresh, Insets)
│   │   │   ├── CrewClockWebChromeClient.kt  # GPS bridge & progress bar handler
│   │   │   ├── CrewClockWebViewClient.kt    # In-app routing & system intent delegation
│   │   │   └── NetworkUtils.kt              # ConnectivityManager network checker
│   │   └── res/
│   │       ├── layout/activity_main.xml     # Native UI (ProgressBar, SwipeRefresh, OfflineView)
│   │       ├── values/                      # colors.xml, strings.xml, themes.xml (#D97706 theme)
│   │       ├── values-night/themes.xml      # Dark mode Material 3 theme
│   │       ├── drawable/                    # Vector assets (ic_wifi_off, ic_splash_clock, icons)
│   │       └── mipmap-anydpi-v26/           # Adaptive icons
├── build.gradle.kts               # Root build configuration
├── settings.gradle.kts            # Module settings
├── gradle.properties              # JVM options & AndroidX configuration
├── gradlew                        # Gradle wrapper script (Unix/Mac)
├── gradlew.bat                    # Gradle wrapper script (Windows)
└── README.md                      # This guide
```

---

## 💻 Opening the Project in Android Studio

1. Launch **Android Studio**.
2. Select **Open** and choose the `iGrill/android` directory.
3. Wait for Gradle Sync to finish.
4. When ready, select an emulator or connected physical device from the device dropdown and click **Run (▶️)** or press `Shift + F10`.

