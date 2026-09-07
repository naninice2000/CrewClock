import SwiftUI

struct AppConfig {
    /// The live hosted GitHub Pages Web App URL.
    /// Changes committed and pushed to GitHub Pages are automatically loaded by the app without App Store updates.
    static let webAppURL = URL(string: "https://naninice2000.github.io/CrewClock/iGrill/")!
    
    // Brand Colors (Amber / Warm Gold matching iGrill & CrewClock)
    static let brandAmber500 = Color(red: 245/255, green: 158/255, blue: 11/255)
    static let brandAmber600 = Color(red: 217/255, green: 119/255, blue: 6/255)
    static let brandAmber700 = Color(red: 180/255, green: 83/255, blue: 9/255)
    static let brandBackground = Color(red: 254/255, green: 252/255, blue: 247/255)
    
    // App Meta
    static let appName = "SheetPunch"
    static let appVersion = "1.0.0"
}
