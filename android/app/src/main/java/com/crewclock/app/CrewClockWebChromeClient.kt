package com.crewclock.app

import android.app.AlertDialog
import android.os.Message
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.EditText
import com.google.android.material.progressindicator.LinearProgressIndicator

class CrewClockWebChromeClient(
    private val progressBar: LinearProgressIndicator,
    private val onGeolocationPrompt: (origin: String?, callback: GeolocationPermissions.Callback?) -> Unit,
    private val onCreateWindowRequest: (view: WebView?, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message?) -> Boolean
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
        return onCreateWindowRequest(view, isDialog, isUserGesture, resultMsg)
    }

    override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
        val ctx = view?.context ?: progressBar.context
        try {
            AlertDialog.Builder(ctx)
                .setTitle("SheetPunch")
                .setMessage(message ?: "")
                .setPositiveButton(android.R.string.ok) { _, _ ->
                    result?.confirm()
                }
                .setOnCancelListener {
                    result?.cancel()
                }
                .show()
            return true
        } catch (e: Exception) {
            result?.cancel()
            return false
        }
    }

    override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
        val ctx = view?.context ?: progressBar.context
        try {
            AlertDialog.Builder(ctx)
                .setTitle("SheetPunch")
                .setMessage(message ?: "")
                .setPositiveButton(android.R.string.ok) { _, _ ->
                    result?.confirm()
                }
                .setNegativeButton(android.R.string.cancel) { _, _ ->
                    result?.cancel()
                }
                .setOnCancelListener {
                    result?.cancel()
                }
                .show()
            return true
        } catch (e: Exception) {
            result?.cancel()
            return false
        }
    }

    override fun onJsPrompt(view: WebView?, url: String?, message: String?, defaultValue: String?, result: JsPromptResult?): Boolean {
        val ctx = view?.context ?: progressBar.context
        try {
            val input = EditText(ctx)
            if (!defaultValue.isNullOrEmpty()) {
                input.setText(defaultValue)
            }
            AlertDialog.Builder(ctx)
                .setTitle("SheetPunch")
                .setMessage(message ?: "")
                .setView(input)
                .setPositiveButton(android.R.string.ok) { _, _ ->
                    result?.confirm(input.text.toString())
                }
                .setNegativeButton(android.R.string.cancel) { _, _ ->
                    result?.cancel()
                }
                .setOnCancelListener {
                    result?.cancel()
                }
                .show()
            return true
        } catch (e: Exception) {
            result?.cancel()
            return false
        }
    }

    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
        Log.d("SheetPunchWeb", "[${consoleMessage?.messageLevel()}] ${consoleMessage?.message()} -- line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
        return true
    }
}
