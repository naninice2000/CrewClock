import Foundation
import WebKit

class WebViewModel: ObservableObject {
    weak var webView: WKWebView?
    
    @Published var estimatedProgress: Double = 0.0
    @Published var isLoading: Bool = false
    @Published var canGoBack: Bool = false
    @Published var canGoForward: Bool = false
    @Published var shouldReload: Bool = false
    @Published var hasFailedInitialLoad: Bool = false
    @Published var errorMessage: String? = nil
    
    func reload() {
        shouldReload = true
    }
    
    func goBack() {
        webView?.goBack()
    }
    
    func goForward() {
        webView?.goForward()
    }
}
