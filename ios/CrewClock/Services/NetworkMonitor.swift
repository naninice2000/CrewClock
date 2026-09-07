import Foundation
import Network

/// Monitors device network connectivity via NWPathMonitor to display a graceful offline view
/// if the employee opens the app without active cellular/Wi-Fi connection.
class NetworkMonitor: ObservableObject {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "CrewClockNetworkMonitorQueue")
    
    @Published var isConnected: Bool = true
    @Published var isExpensive: Bool = false
    
    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = (path.status == .satisfied)
                self?.isExpensive = path.isExpensive
            }
        }
        monitor.start(queue: queue)
    }
    
    deinit {
        monitor.cancel()
    }
}
