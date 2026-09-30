package com.example

import android.app.Application
import android.util.Log
import java.io.File

class App : Application() {
    override fun onCreate() {
        super.onCreate()

        try {
            val nestedCodeCache = File(cacheDir, "WebView/Default/HTTP Cache/Code Cache")
            if (nestedCodeCache.exists()) {
                nestedCodeCache.deleteRecursively()
            }
        } catch (e: Exception) {
            Log.w("App", "Cache cleanup: ${e.message}")
        }
    }
}
