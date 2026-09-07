import SwiftUI
import WebKit

struct WebViewContainer: UIViewRepresentable {
    let url: URL
    @ObservedObject var viewModel: WebViewModel
    
    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        // 1. Enable JavaScript Popup Windows (Essential for Google Identity Services)
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        if #available(iOS 14.0, *) {
            config.defaultWebpagePreferences.allowsContentJavaScript = true
        } else {
            config.preferences.javaScriptEnabled = true
        }
        
        // Native App Environment Flag for Web App
        let nativeScript = WKUserScript(
            source: "window.__SHEETPUNCH_NATIVE_APP__ = true; window.__CREWCLOCK_NATIVE_APP__ = true; window.__SHEETPUNCH_PLATFORM__ = 'ios'; window.__CREWCLOCK_PLATFORM__ = 'ios';",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        config.userContentController.addUserScript(nativeScript)
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.bounces = true
        webView.backgroundColor = UIColor(red: 254/255, green: 252/255, blue: 247/255, alpha: 1.0)
        webView.isOpaque = false
        
        // 2. Pure Standard Mobile Safari User-Agent (Prevents Google's 403 disallowed_useragent and identifies app)
        webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 SheetPunchApp/1.0 CrewClockApp/1.0 (iOS)"
        
        // 3. Setup Native Pull-to-Refresh with Amber Tint
        let refreshControl = UIRefreshControl()
        refreshControl.tintColor = UIColor(red: 217/255, green: 119/255, blue: 6/255, alpha: 1.0)
        refreshControl.addTarget(context.coordinator, action: #selector(Coordinator.handleRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl
        
        // 4. Track Estimated Progress and URL states using KVO
        context.coordinator.setupObservers(for: webView)
        viewModel.webView = webView
        
        // Always load latest code from GitHub Pages
        let request = URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30)
        webView.load(request)
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        if viewModel.shouldReload {
            viewModel.shouldReload = false
            uiView.reload()
        }
    }
    
    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var viewModel: WebViewModel
        private var popupWebView: WKWebView?
        private var popupViewController: UIViewController?
        private var progressObservation: NSKeyValueObservation?
        private var canGoBackObservation: NSKeyValueObservation?
        private var canGoForwardObservation: NSKeyValueObservation?
        
        init(viewModel: WebViewModel) {
            self.viewModel = viewModel
            super.init()
        }
        
        func setupObservers(for webView: WKWebView) {
            progressObservation = webView.observe(\.estimatedProgress, options: .new) { [weak self] webView, _ in
                DispatchQueue.main.async {
                    self?.viewModel.estimatedProgress = webView.estimatedProgress
                }
            }
            canGoBackObservation = webView.observe(\.canGoBack, options: .new) { [weak self] webView, _ in
                DispatchQueue.main.async {
                    self?.viewModel.canGoBack = webView.canGoBack
                }
            }
            canGoForwardObservation = webView.observe(\.canGoForward, options: .new) { [weak self] webView, _ in
                DispatchQueue.main.async {
                    self?.viewModel.canGoForward = webView.canGoForward
                }
            }
        }
        
        @objc func handleRefresh(_ sender: UIRefreshControl) {
            viewModel.webView?.reload()
        }
        
        // MARK: - WKUIDelegate Popup / Window.open Handling (Google Sign-In Support)
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
            
            let popup = WKWebView(frame: .zero, configuration: configuration)
            popup.customUserAgent = webView.customUserAgent
            popup.uiDelegate = self
            popup.navigationDelegate = self
            self.popupWebView = popup
            
            // Present Google OAuth popup in a native modal view controller
            let hostVC = UIViewController()
            hostVC.view.backgroundColor = .systemBackground
            
            popup.translatesAutoresizingMaskIntoConstraints = false
            hostVC.view.addSubview(popup)
            NSLayoutConstraint.activate([
                popup.topAnchor.constraint(equalTo: hostVC.view.safeAreaLayoutGuide.topAnchor),
                popup.leadingAnchor.constraint(equalTo: hostVC.view.leadingAnchor),
                popup.trailingAnchor.constraint(equalTo: hostVC.view.trailingAnchor),
                popup.bottomAnchor.constraint(equalTo: hostVC.view.bottomAnchor)
            ])
            
            let navVC = UINavigationController(rootViewController: hostVC)
            hostVC.navigationItem.title = "Sign In with Google"
            hostVC.navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem: .cancel, target: self, action: #selector(dismissPopup))
            
            if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let rootVC = windowScene.windows.first?.rootViewController {
                self.popupViewController = navVC
                rootVC.present(navVC, animated: true, completion: nil)
            }
            
            return popup
        }
        
        @objc func dismissPopup() {
            popupViewController?.dismiss(animated: true) { [weak self] in
                self?.popupWebView = nil
                self?.popupViewController = nil
            }
        }
        
        func webViewDidClose(_ webView: WKWebView) {
            if webView == popupWebView {
                dismissPopup()
            }
        }
        
        // MARK: - WKNavigationDelegate
        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            if webView != popupWebView {
                viewModel.isLoading = true
            }
        }
        
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            if webView != popupWebView {
                viewModel.isLoading = false
                viewModel.hasLoadedOnce = true
                viewModel.hasFailedInitialLoad = false
                webView.scrollView.refreshControl?.endRefreshing()
            }
        }
        
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            if webView != popupWebView {
                viewModel.isLoading = false
                webView.scrollView.refreshControl?.endRefreshing()
                let nsError = error as NSError
                if nsError.code != NSURLErrorCancelled {
                    viewModel.hasFailedInitialLoad = true
                    viewModel.errorMessage = error.localizedDescription
                }
            }
        }
        
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            if webView != popupWebView {
                viewModel.isLoading = false
                webView.scrollView.refreshControl?.endRefreshing()
                let nsError = error as NSError
                if nsError.code != NSURLErrorCancelled {
                    viewModel.hasFailedInitialLoad = true
                    viewModel.errorMessage = error.localizedDescription
                }
            }
        }
        
        // Route system schemes (tel, mailto, maps) outside WebView
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let navURL = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            
            let scheme = navURL.scheme?.lowercased() ?? ""
            if ["tel", "mailto", "sms"].contains(scheme) {
                if UIApplication.shared.canOpenURL(navURL) {
                    UIApplication.shared.open(navURL)
                }
                decisionHandler(.cancel)
                return
            }
            
            // Allow Google Maps links to open in external browser or Maps app
            if navURL.host?.contains("google.com") == true && navURL.path.contains("maps") {
                if navigationAction.navigationType == .linkActivated {
                    UIApplication.shared.open(navURL)
                    decisionHandler(.cancel)
                    return
                }
            }
            
            decisionHandler(.allow)
        }
    }
}
