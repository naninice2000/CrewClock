package com.crewclock.app

import android.os.Message
import android.view.View
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.WebView
import com.google.android.material.progressindicator.LinearProgressIndicator

class CrewClockWebChromeClient(
    private val progressBar: LinearProgressIndicator,
    private val onGeolocationPrompt: (origin: String?, callback: GeolocationPermissions.Callback?) -> Unit
) : WebChromeClient() {

    override fun onProgressChanged(view: WebView?, newProgress: Int) {
        super.onProgressChanged(view, newProgress)
        if (newProgress < 100) {
            progressBar.visibility = View.VISIBLE
            progressBar.progress = newProgress
        } else {
            progressBar.visibility = View.GONE
        }
    }

    override fun onGeolocationPermissionsShowPrompt(
        origin: String?,
        callback: GeolocationPermissions.Callback?
    ) {
        onGeolocationPrompt(origin, callback)
    }

    override fun onCreateWindow(
        view: WebView?,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: Message?
    ): Boolean {
        // Support Google OAuth popup windows inside WebView
        val href = view?.handler?.obtainMessage()
        view?.requestFocusNodeHref(href)
        return super.onCreateWindow(view, isDialog, isUserGesture, resultMsg)
    }
}
