package com.crewclock.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Dialog
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import com.crewclock.app.databinding.ActivityMainBinding
import com.crewclock.app.databinding.DialogOauthBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val appUrl by lazy { getString(R.string.app_url) }
    private var isPageLoadedSuccessfully = false
    private var currentOAuthDialog: Dialog? = null

    // Pending Geolocation Callback from WebChromeClient
    private var pendingGeolocationOrigin: String? = null
    private var pendingGeolocationCallback: GeolocationPermissions.Callback? = null

    // Location Permission Launcher
    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseLocationGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false

        val granted = fineLocationGranted || coarseLocationGranted
        pendingGeolocationCallback?.invoke(pendingGeolocationOrigin, granted, false)
        pendingGeolocationCallback = null
        pendingGeolocationOrigin = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // 1. Install AndroidX Splash Screen before super.onCreate()
        val splashScreen = installSplashScreen()
        splashScreen.setKeepOnScreenCondition { !isPageLoadedSuccessfully }
        
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // 2. Setup System Bars
        setupSystemBars()

        // 3. Initialize WebView and Settings
        setupWebView()

        // 4. Setup Swipe-to-Refresh with Amber Accent
        setupSwipeRefresh()

        // 5. Setup Hardware Back Navigation
        setupBackNavigation()

        // 6. Setup Offline Retry Handler
        setupOfflineRetry()

        // 7. Request Initial Location Permission for Clock-In
        checkAndRequestLocationPermission()

        // 8. Load Hosted Web App URL
        loadWebAppUrl()
    }

    private fun setupSystemBars() {
        val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
        // White text/icons on amber status bar
        windowInsetsController.isAppearanceLightStatusBars = false
        
        val isDarkMode = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        windowInsetsController.isAppearanceLightNavigationBars = !isDarkMode
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webView = binding.webView
        val settings = webView.settings

        // Enable core web capabilities
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.setGeolocationEnabled(true)

        // Enable Popup Windows for Google OAuth
        settings.setSupportMultipleWindows(true)
        settings.javaScriptCanOpenWindowsAutomatically = true

        // Viewport & Scaling
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false

        // Cache & Performance
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        // Custom User Agent to satisfy Google Identity Services and identify native app
        val defaultUserAgent = settings.userAgentString
        val cleanUserAgent = defaultUserAgent.replace("; wv", "").replace("Version/4.0 ", "") + " CrewClockApp/1.0 (Android)"
        settings.userAgentString = cleanUserAgent

        // Cookie Management for Google OAuth
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true)
        }

        // Register Native JavaScript Bridge to auto-dismiss OAuth dialog on auth success & platform detection
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun onAuthSuccess() {
                runOnUiThread {
                    dismissOAuthDialog()
                }
            }

            @JavascriptInterface
            fun isNativeApp(): Boolean = true

            @JavascriptInterface
            fun getPlatform(): String = "android"
        }, "AndroidBridge")

        // Setup Clients
        webView.webViewClient = CrewClockWebViewClient(
            context = this,
            onPageLoadFinished = { success ->
                binding.swipeRefreshLayout.isRefreshing = false
                if (success) {
                    isPageLoadedSuccessfully = true
                    showWebView()
                } else {
                    if (!isPageLoadedSuccessfully) {
                        showOfflineView()
                    }
                }
            },
            onErrorOccurred = {
                binding.swipeRefreshLayout.isRefreshing = false
                if (!isPageLoadedSuccessfully) {
                    showOfflineView()
                }
            }
        )

        webView.webChromeClient = CrewClockWebChromeClient(
            progressBar = binding.progressBar,
            onGeolocationPrompt = { origin, callback ->
                handleGeolocationPrompt(origin, callback)
            },
            onCreateWindowRequest = { view, isDialog, isUserGesture, resultMsg ->
                handleCreateWindow(view, resultMsg)
            }
        )
    }

    private fun handleGeolocationPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
        val fineLocationGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val coarseLocationGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (fineLocationGranted || coarseLocationGranted) {
            callback?.invoke(origin, true, false)
        } else {
            pendingGeolocationOrigin = origin
            pendingGeolocationCallback = callback
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    private fun checkAndRequestLocationPermission() {
        val fineLocationGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!fineLocationGranted) {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefreshLayout.setColorSchemeResources(
            R.color.brand_amber_600,
            R.color.brand_amber_700,
            R.color.brand_amber_500
        )
        binding.swipeRefreshLayout.setOnRefreshListener {
            if (NetworkUtils.isNetworkAvailable(this)) {
                binding.webView.reload()
            } else {
                binding.swipeRefreshLayout.isRefreshing = false
                if (!isPageLoadedSuccessfully) {
                    showOfflineView()
                }
            }
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (currentOAuthDialog?.isShowing == true) {
                    dismissOAuthDialog()
                } else if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun setupOfflineRetry() {
        binding.btnRetry.setOnClickListener {
            if (NetworkUtils.isNetworkAvailable(this)) {
                showWebView()
                loadWebAppUrl()
            }
        }
    }

    private fun loadWebAppUrl() {
        if (NetworkUtils.isNetworkAvailable(this)) {
            showWebView()
            binding.webView.loadUrl(appUrl)
        } else {
            showOfflineView()
        }
    }

    private fun showWebView() {
        binding.splashOverlay.visibility = View.GONE
        binding.offlineContainer.visibility = View.GONE
        binding.swipeRefreshLayout.visibility = View.VISIBLE
    }

    private fun showOfflineView() {
        binding.splashOverlay.visibility = View.GONE
        binding.swipeRefreshLayout.visibility = View.GONE
        binding.offlineContainer.visibility = View.VISIBLE
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun handleCreateWindow(view: WebView?, resultMsg: Message?): Boolean {
        val popupWebView = WebView(this)

        // 1. Configure settings matching clean user agent to satisfy Google Identity Services
        val cleanUserAgent = binding.webView.settings.userAgentString
        popupWebView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            userAgentString = cleanUserAgent
            cacheMode = WebSettings.LOAD_DEFAULT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }
        }

        // 2. Enable Cookies for Google OAuth
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(popupWebView, true)
        }

        // 3. Inflate Modal Dialog Layout
        val dialogBinding = DialogOauthBinding.inflate(layoutInflater)
        dialogBinding.oauthWebContainer.addView(
            popupWebView,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )

        val dialog = Dialog(this, android.R.style.Theme_DeviceDefault_Light_NoActionBar_Fullscreen)
        dialog.setContentView(dialogBinding.root)
        dialog.setCancelable(true)

        dialogBinding.btnCloseOAuth.setOnClickListener {
            dismissOAuthDialog()
        }

        // 4. Setup WebChromeClient with onCloseWindow to dismiss dialog
        popupWebView.webChromeClient = object : WebChromeClient() {
            override fun onCloseWindow(window: WebView?) {
                runOnUiThread {
                    dismissOAuthDialog()
                }
            }

            override fun onProgressChanged(v: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    dialogBinding.oauthProgressBar.visibility = View.VISIBLE
                    dialogBinding.oauthProgressBar.progress = newProgress
                } else {
                    dialogBinding.oauthProgressBar.visibility = View.GONE
                }
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                Log.d("CrewClockOAuth", "[${consoleMessage?.messageLevel()}] ${consoleMessage?.message()} -- line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
                return true
            }
        }

        // 5. Setup WebViewClient
        popupWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                val uri = Uri.parse(url)
                if (uri.scheme in listOf("tel", "mailto", "sms", "geo")) {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                    return true
                }
                return false
            }

            override fun onPageFinished(v: WebView?, url: String?) {
                super.onPageFinished(v, url)
                // If OAuth completion rendered an empty or about:blank landing page
                if (url == "about:blank") {
                    v?.postDelayed({
                        dismissOAuthDialog()
                    }, 400)
                }
            }
        }

        // 6. Connect Transport
        val transport = resultMsg?.obj as? WebView.WebViewTransport
        transport?.webView = popupWebView
        resultMsg?.sendToTarget()

        // 7. Manage Dialog Lifecycle
        dialog.setOnDismissListener {
            try {
                cookieManager.flush()
                popupWebView.destroy()
            } catch (e: Exception) {
                e.printStackTrace()
            }
            if (currentOAuthDialog == dialog) {
                currentOAuthDialog = null
            }
        }

        currentOAuthDialog = dialog
        dialog.show()
        return true
    }

    private fun dismissOAuthDialog() {
        try {
            if (currentOAuthDialog?.isShowing == true) {
                currentOAuthDialog?.dismiss()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        currentOAuthDialog = null
    }

    override fun onDestroy() {
        dismissOAuthDialog()
        binding.webView.destroy()
        super.onDestroy()
    }
}
