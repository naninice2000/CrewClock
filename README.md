# ⏰ CrewClock - Restaurant Staff Attendance & Time Clock

A unified mobile attendance and employee time clock system with **tamper-proof Google Server Time**, **GPS Geolocation**, and **Native iOS & Android App Wrappers**.

---

## 📁 Repository Overview

* **[`iGrill/`](iGrill/)**: The hosted web application (HTML5, Tailwind CSS, Google Identity Services, Google Apps Script).
  * Hosted live at: **`https://naninice2000.github.io/CrewClock/iGrill/`**
  * Auto-logs attendance, timestamps, GPS coordinates, and Google Maps pins directly to your **Google Sheet**.
  * Calculates shift duration directly on Google's cloud servers in your restaurant's time zone.
* **[`iGrill/ios/`](iGrill/ios/)**: The native iOS application (`CrewClock.xcodeproj`).
  * Built with Swift, SwiftUI, and WebKit (`WKWebView`).
  * Wraps the live hosted web app so **any changes pushed to GitHub Pages are instantly reflected without needing App Store updates**.
  * Full support for iOS GPS location permissions and Google Sign-In popups.
* **[`iGrill/android/`](iGrill/android/)**: The native Android application (Gradle project).
  * Built with Kotlin, Android Jetpack, and `WebView`.
  * Features automatic User-Agent sanitization for Google Sign-In (`403 disallowed_useragent` bypass), GPS geolocation bridging, pull-to-refresh, and offline support.

---

## 🚀 Quick Links & Setup Guides

* **📖 Full Project Wiki & Multi-Tenant Guide**: Read the [CrewClock Wiki](WIKI.md) for full architectural blueprints, RBAC security matrix, platform setup, and the complete Merchant Getting Started guide.
* **Web App Setup**: Follow the [iGrill Setup Guide](iGrill/README.md) to connect Google Apps Script and Google OAuth.
* **iOS App Setup & Dev Phone Install**: Follow the [iOS App Guide](iGrill/ios/README.md) to compile with Xcode or CLI, enable Developer Mode, and deploy to your physical iPhone for free.
* **Android App Setup**: Follow the [Android App Guide](iGrill/android/README.md) to open the project in Android Studio or build the APK with Gradle when ready.

