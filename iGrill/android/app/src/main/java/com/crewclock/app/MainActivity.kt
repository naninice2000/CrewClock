package com.crewclock.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.WebSettings
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import com.crewclock.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val appUrl by lazy { getString(R.string.app_url) }
    private var isPageLoadedSuccessfully = false

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
        installSplashScreen()
        
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

        // Custom User Agent to satisfy Google Identity Services (stripping '; wv' prevents 403 disallowed_useragent)
        val defaultUserAgent = settings.userAgentString
        val cleanUserAgent = defaultUserAgent.replace("; wv", "").replace("Version/4.0 ", "")
        settings.userAgentString = cleanUserAgent

        // Cookie Management for Google OAuth
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true)
        }

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
                if (binding.webView.canGoBack()) {
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
        binding.offlineContainer.visibility = View.GONE
        binding.swipeRefreshLayout.visibility = View.VISIBLE
    }

    private fun showOfflineView() {
        binding.swipeRefreshLayout.visibility = View.GONE
        binding.offlineContainer.visibility = View.VISIBLE
    }

    override fun onDestroy() {
        binding.webView.destroy()
        super.onDestroy()
    }
}
