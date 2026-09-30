package com.example

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.Executors

class WhatsAppNotificationService : NotificationListenerService() {

    companion object {
        private const val API_URL = "https://bnycpdjgpicvqvxwouil.supabase.co/functions/v1/jm-whatsapp-gateway"
        private const val APP_KEY = "ITyHiTGc7tykzwOrV6ZjDFx4irNMfQi8"
        private const val PREFS = "jm_whatsapp_monitor"
        private const val KEY_TITLE = "authorized_title"
        private const val DEFAULT_TITLE = "Farmácia JM"
        private const val SEEN_WINDOW_MS = 30000L
    }

    private val executor = Executors.newSingleThreadExecutor()

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        if (sbn.packageName != "com.whatsapp") return

        val notification = sbn.notification ?: return

        if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) {
            return
        }

        val extras = notification.extras ?: return

        val title = extras
            .getCharSequence(Notification.EXTRA_TITLE)
            ?.toString()
            ?.trim()
            .orEmpty()

        val allowed = getSharedPreferences(
            PREFS,
            Context.MODE_PRIVATE
        ).getString(
            KEY_TITLE,
            DEFAULT_TITLE
        ).orEmpty().trim()

        if (allowed.isBlank()) return
        if (!matchesAuthorizedTitle(title, allowed)) return

        val texts = LinkedHashSet<String>()

        extras
            .getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
            ?.forEach { line ->
                val value = line?.toString()?.trim().orEmpty()
                if (value.isNotBlank()) texts.add(value)
            }

        val bigText = extras
            .getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?.toString()
            ?.trim()
            .orEmpty()

        if (bigText.isNotBlank()) texts.add(bigText)

        val normalText = extras
            .getCharSequence(Notification.EXTRA_TEXT)
            ?.toString()
            ?.trim()
            .orEmpty()

        if (normalText.isNotBlank()) texts.add(normalText)
        if (texts.isEmpty()) return

        for (text in texts) {
            if (isNoise(text)) continue

            val dedupeKey = sha256(
                normalize(title) + "|" + normalize(text)
            )

            if (wasSeenRecently(dedupeKey)) continue

            rememberSeen(dedupeKey)

            executor.execute {
                postMessage(
                    title = title,
                    text = text,
                    notificationId = dedupeKey,
                    postTime = sbn.postTime
                )
            }
        }
    }

    private fun matchesAuthorizedTitle(
        actual: String,
        allowed: String
    ): Boolean {
        val a = normalize(actual)
        val b = normalize(allowed)

        if (a.isBlank() || b.isBlank()) return false

        return a == b || a.contains(b) || b.contains(a)
    }

    private fun normalize(value: String): String {
        return value
            .lowercase(Locale.ROOT)
            .replace('á', 'a')
            .replace('à', 'a')
            .replace('ã', 'a')
            .replace('â', 'a')
            .replace('é', 'e')
            .replace('ê', 'e')
            .replace('í', 'i')
            .replace('ó', 'o')
            .replace('ô', 'o')
            .replace('õ', 'o')
            .replace('ú', 'u')
            .replace('ç', 'c')
            .trim()
    }

    private fun isNoise(text: String): Boolean {
        val n = normalize(text)

        if (n.contains("nova mensagem")) return true
        if (n.contains("novas mensagens")) return true
        if (n.contains("whatsapp web")) return true
        if (n.contains("procurando novas mensagens")) return true
        if (n.contains("verificando novas mensagens")) return true
        if (n.contains("backup")) return true
        if (n.contains("chamada de voz")) return true
        if (n.contains("chamada de video")) return true

        return false
    }

    private fun wasSeenRecently(key: String): Boolean {
        val prefs = getSharedPreferences(
            PREFS,
            Context.MODE_PRIVATE
        )

        val last = prefs.getLong("seen_" + key, 0L)

        if (last <= 0L) return false

        return System.currentTimeMillis() - last < SEEN_WINDOW_MS
    }

    private fun rememberSeen(key: String) {
        getSharedPreferences(
            PREFS,
            Context.MODE_PRIVATE
        ).edit()
            .putLong("seen_" + key, System.currentTimeMillis())
            .apply()
    }

    private fun postMessage(
        title: String,
        text: String,
        notificationId: String,
        postTime: Long
    ) {
        var con: HttpURLConnection? = null

        try {
            con = URL(API_URL).openConnection() as HttpURLConnection

            con.requestMethod = "POST"
            con.connectTimeout = 10000
            con.readTimeout = 10000
            con.doOutput = true
            con.setRequestProperty("Content-Type", "application/json")
            con.setRequestProperty("x-jm-key", APP_KEY)

            val payload = JSONObject()
                .put("action", "notification_message")
                .put("source_title", title)
                .put("text", text)
                .put("notification_id", notificationId)
                .put("package_name", "com.whatsapp")
                .put("posted_at", postTime)
                .toString()

            con.outputStream.use { output ->
                output.write(payload.toByteArray(Charsets.UTF_8))
            }

            try {
                val stream =
                    if (con.responseCode in 200..299) {
                        con.inputStream
                    } else {
                        con.errorStream
                    }

                stream?.bufferedReader()?.use { it.readText() }
            } catch (_: Exception) {
            }

        } catch (_: Exception) {
        } finally {
            try {
                con?.disconnect()
            } catch (_: Exception) {
            }
        }
    }

    private fun sha256(value: String): String {
        val bytes = MessageDigest
            .getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))

        return bytes.joinToString("") { byte ->
            "%02x".format(byte)
        }
    }
}
