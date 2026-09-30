package com.example

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import org.json.JSONArray

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import java.io.File
import java.io.FileOutputStream

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        filePathCallback?.onReceiveValue(uris)
        filePathCallback = null
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.evaluateJavascript("window.dispatchEvent(new Event('jm:resume'));", null)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)

        // Clean up any improperly nested Code Cache inside HTTP Cache
        try {
            val nestedCodeCache = File(cacheDir, "WebView/Default/HTTP Cache/Code Cache")
            if (nestedCodeCache.exists()) {
                nestedCodeCache.deleteRecursively()
            }
        } catch (e: Exception) {
            Log.w("MainActivity", "Cache cleanup: ${e.message}")
        }

        webView = WebView(this)
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        setContentView(webView)

        setupWebView()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    """
                    (function() {
                        var modal = document.getElementById('modalBg');
                        if (modal && modal.classList.contains('show')) {
                            if (typeof closeModal === 'function') closeModal(false);
                            return true;
                        }
                        var sheet = document.getElementById('tipoSheet');
                        if (sheet && sheet.classList.contains('show')) {
                            if (typeof fecharTipoSheet === 'function') fecharTipoSheet();
                            return true;
                        }
                        return false;
                    })();
                    """.trimIndent()
                ) { result ->
                    if (result == "false") {
                        if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                        }
                    }
                }
            }
        })

        webView.loadUrl("file:///android_asset/index.html")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.setSupportZoom(false)

        webView.addJavascriptInterface(WebAppInterface(), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                val scheme = uri.scheme ?: return false

                if (scheme == "whatsapp" || uri.host?.contains("wa.me") == true || uri.host?.contains("api.whatsapp.com") == true) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, uri)
                        startActivity(intent)
                        return true
                    } catch (e: ActivityNotFoundException) {
                        Toast.makeText(this@MainActivity, "WhatsApp não instalado", Toast.LENGTH_SHORT).show()
                        return true
                    }
                }

                if (scheme == "tel" || scheme == "mailto") {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                        return true
                    } catch (e: Exception) {
                        return true
                    }
                }

                if (scheme == "file") {
                    return false
                }

                try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    return true
                } catch (e: Exception) {
                    return false
                }
            }

            override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
                Log.e("MainActivity", "WebView render process exited. Recreating activity.")
                view?.destroy()
                recreate()
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                Log.d("WebViewConsole", "${consoleMessage?.message()} [${consoleMessage?.sourceId()}:${consoleMessage?.lineNumber()}]")
                return true
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }

                try {
                    fileChooserLauncher.launch(intent)
                } catch (e: ActivityNotFoundException) {
                    this@MainActivity.filePathCallback = null
                    return false
                }
                return true
            }
        }
    }

    inner class WebAppInterface {

        @JavascriptInterface
        fun saveReport(dataUrl: String, requestedName: String): String {
            return try {
                require(dataUrl.startsWith("data:image/png;base64,"))
                val bytes = Base64.decode(dataUrl.substringAfter(","), Base64.DEFAULT)
                require(BitmapFactory.decodeByteArray(bytes, 0, bytes.size) != null)
                val directory = File(cacheDir, "images").apply { mkdirs() }
                val safeName = requestedName.removeSuffix(".png").replace(Regex("[^A-Za-z0-9._-]"), "_").take(160)
                val file = File.createTempFile(safeName + "-", ".png", directory)
                // Os mesmos bytes PNG da prévia, sem recompressão.
                file.outputStream().use { it.write(bytes) }
                FileProvider.getUriForFile(this@MainActivity, applicationContext.packageName + ".fileprovider", file).toString()
            } catch (e: Exception) {
                Log.e("MainActivity", "Falha ao salvar relatório", e)
                ""
            }
        }

        @JavascriptInterface
        fun shareReport(reportUri: String, title: String?) {
            runOnUiThread {
                try {
                    val uri = Uri.parse(reportUri)
                    require(uri.scheme == "content" && uri.authority == applicationContext.packageName + ".fileprovider")
                    contentResolver.openInputStream(uri)?.use { require(it.read() != -1) }
                        ?: error("Arquivo do relatório indisponível")
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "image/png"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        putExtra(Intent.EXTRA_SUBJECT, title ?: "Relatório JM Estoque")
                        clipData = android.content.ClipData.newRawUri("Relatório", uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    startActivity(Intent.createChooser(intent, "Enviar via WhatsApp / Compartilhar"))
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Erro ao compartilhar: " + e.localizedMessage, Toast.LENGTH_LONG).show()
                }
            }
        }

        @JavascriptInterface
        fun shareText(text: String, title: String?) {
            runOnUiThread {
                try {
                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, text)
                        putExtra(Intent.EXTRA_SUBJECT, title ?: "JM Estoque")
                    }
                    startActivity(Intent.createChooser(shareIntent, "Compartilhar"))
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Erro ao compartilhar: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface
        fun saveBackup(json: String, requestedName: String?): String {
            return try {
                val safeName = (requestedName ?: "backup_jm.json")
                    .replace(Regex("[^A-Za-z0-9._-]"), "_")
                    .let { if (it.endsWith(".json", ignoreCase = true)) it else "$it.json" }

                val bytes = json.toByteArray(Charsets.UTF_8)
                var result = ""

                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    val values = android.content.ContentValues().apply {
                        put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, safeName)
                        put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "application/json")
                        put(
                            android.provider.MediaStore.MediaColumns.RELATIVE_PATH,
                            android.os.Environment.DIRECTORY_DOWNLOADS + "/JMEstoque"
                        )
                        put(android.provider.MediaStore.MediaColumns.IS_PENDING, 1)
                    }

                    val collection = android.provider.MediaStore.Downloads.getContentUri(
                        android.provider.MediaStore.VOLUME_EXTERNAL_PRIMARY
                    )

                    val uri = contentResolver.insert(collection, values)
                        ?: throw IllegalStateException("Nao foi possivel criar o arquivo em Downloads")

                    contentResolver.openOutputStream(uri)?.use { out ->
                        out.write(bytes)
                        out.flush()
                    } ?: throw IllegalStateException("Nao foi possivel abrir o arquivo de backup")

                    values.clear()
                    values.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 0)
                    contentResolver.update(uri, values, null, null)

                    result = "Download/JMEstoque/$safeName"
                } else {
                    val dir = getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS)
                        ?: filesDir
                    val folder = File(dir, "JMEstoque")
                    folder.mkdirs()
                    val file = File(folder, safeName)
                    file.writeBytes(bytes)
                    result = file.absolutePath
                }

                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "Backup salvo em $result",
                        Toast.LENGTH_LONG
                    ).show()
                }

                result
            } catch (e: Exception) {
                Log.e("JMBackup", "Erro ao salvar backup", e)
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "Erro ao salvar backup: ${e.localizedMessage}",
                        Toast.LENGTH_LONG
                    ).show()
                }
                ""
            }
        }

        @JavascriptInterface
        fun shareBackup(json: String, requestedName: String?) {
            try {
                val safeName = (requestedName ?: "backup_jm.json")
                    .replace(Regex("[^A-Za-z0-9._-]"), "_")
                    .let { if (it.endsWith(".json", ignoreCase = true)) it else "$it.json" }

                val dir = File(cacheDir, "backup")
                dir.mkdirs()
                val file = File(dir, safeName)
                file.writeText(json, Charsets.UTF_8)

                val uri = FileProvider.getUriForFile(
                    this@MainActivity,
                    "${applicationContext.packageName}.fileprovider",
                    file
                )

                runOnUiThread {
                    try {
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "application/json"
                            putExtra(Intent.EXTRA_STREAM, uri)
                            putExtra(Intent.EXTRA_SUBJECT, "Backup JM Estoque")
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        startActivity(Intent.createChooser(intent, "Compartilhar backup"))
                    } catch (e: Exception) {
                        Toast.makeText(
                            this@MainActivity,
                            "Erro ao compartilhar backup: ${e.localizedMessage}",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            } catch (e: Exception) {
                Log.e("JMBackup", "Erro ao compartilhar backup", e)
            }
        }




        // JM_V93_BRIDGE_START
        @JavascriptInterface
        fun saveWhatsAppMonitorTitle(title: String) {
            getSharedPreferences("jm_whatsapp_monitor", MODE_PRIVATE)
                .edit().putString("authorized_title", title.trim()).apply()
        }

        @JavascriptInterface
        fun getWhatsAppMonitorTitle(): String {
            return getSharedPreferences("jm_whatsapp_monitor", MODE_PRIVATE)
                .getString("authorized_title", "Farmácia JM") ?: "Farmácia JM"
        }

        @JavascriptInterface
        fun isWhatsAppMonitorEnabled(): Boolean {
            val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners") ?: return false
            return flat.contains(packageName)
        }

        @JavascriptInterface
        fun openWhatsAppMonitorSettings() {
            runOnUiThread {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            }
        }
        // JM_V93_BRIDGE_END

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
