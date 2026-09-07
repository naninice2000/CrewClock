package com.crewclock.app

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class CrewClockWebViewClient(
    private val context: Context,
    private val onPageLoadFinished: (Boolean) -> Unit,
    private val onErrorOccurred: () -> Unit
) : WebViewClient() {

    private var hasError = false

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        hasError = false
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        onPageLoadFinished(!hasError)
    }

    override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?
    ) {
        super.onReceivedError(view, request, error)
        if (request?.isForMainFrame == true) {
            hasError = true
            onErrorOccurred()
        }
    }

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val url = request?.url?.toString() ?: return false
        val uri = Uri.parse(url)

        // Handle external system schemes
        return when (uri.scheme) {
            "tel", "mailto", "sms", "geo" -> {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, uri)
                    context.startActivity(intent)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                true
            }
            else -> {
                // Route Google Maps links to the Maps application if tapped directly
                if (url.contains("maps.google.com") || url.contains("google.com/maps")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, uri)
                        context.startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
                false
            }
        }
    }
}
