import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = WebViewModel()
    @StateObject private var networkMonitor = NetworkMonitor()
    @StateObject private var locationManager = LocationManager()
    
    var body: some View {
        ZStack(alignment: .top) {
            // Main Web App Canvas
            WebViewContainer(url: AppConfig.webAppURL, viewModel: viewModel)
                .ignoresSafeArea(edges: .bottom)
            
            // Top Linear Progress Bar
            if viewModel.isLoading && viewModel.estimatedProgress < 1.0 {
                GeometryReader { geometry in
                    Rectangle()
                        .fill(AppConfig.brandAmber600)
                        .frame(width: geometry.size.width * CGFloat(viewModel.estimatedProgress), height: 3)
                        .animation(.linear(duration: 0.1), value: viewModel.estimatedProgress)
                }
                .frame(height: 3)
                .transition(.opacity)
            }
            
            // Offline Screen Overlay
            if (!networkMonitor.isConnected && viewModel.hasFailedInitialLoad) {
                OfflineView {
                    viewModel.hasFailedInitialLoad = false
                    viewModel.reload()
                }
                .transition(.opacity)
            }
        }
        .background(AppConfig.brandBackground.ignoresSafeArea())
        .onAppear {
            // Prompt for GPS location access immediately on launch so employee clock-in works
            locationManager.requestLocationPermission()
        }
    }
}
