package com.example

import android.app.Notification
import android.content.ComponentName
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.text.Normalizer
import java.util.concurrent.Executors

/** Local durable inbox. No network dependency and no stock writes. */
class WhatsAppNotificationService : NotificationListenerService() {
    companion object {
        const val PREFS = "jm_whatsapp_monitor"
        @Volatile var connected = false
        val lock = Any()
        @Volatile var onCaptured: (() -> Unit)? = null
    }
    private val worker = Executors.newSingleThreadExecutor()
    private val prefs get() = getSharedPreferences(PREFS, MODE_PRIVATE)
    override fun onListenerConnected() {
        connected = true
        prefs.edit().putLong("lastConnection", System.currentTimeMillis()).apply()
        try { activeNotifications?.forEach { onNotificationPosted(it) } } catch (e: Exception) { error(e) }
    }
    override fun onListenerDisconnected() {
        connected = false
        val now = System.currentTimeMillis()
        prefs.edit().putLong("lastDisconnection", now).apply()
        if (prefs.getBoolean("enabled", true) && now - prefs.getLong("lastRebind", 0) > 60000) {
            prefs.edit().putLong("lastRebind", now).apply()
            try { requestRebind(ComponentName(this, WhatsAppNotificationService::class.java)) }
            catch (e: Exception) { error(e) }
        }
    }
    private fun norm(s: String) = Normalizer.normalize(s, Normalizer.Form.NFD)
        .replace("\\p{M}+".toRegex(), "").lowercase(java.util.Locale.ROOT).trim().replace("\\s+".toRegex(), " ")
    private fun error(e: Exception) { prefs.edit().putString("lastError", e.javaClass.simpleName).apply() }
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null || !prefs.getBoolean("enabled", true)) return
        if (sbn.packageName != "com.whatsapp" && !(sbn.packageName == "com.whatsapp.w4b" && prefs.getBoolean("business", false))) return
        worker.execute {
            val start = System.nanoTime()
            try {
                val n = sbn.notification
                if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return@execute
                val e = n.extras
                val title = e.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString()?.takeIf { it.isNotBlank() }
                    ?: e.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
                val allowed = prefs.getString("authorized_title", "Farmácia JM").orEmpty()
                if (allowed.isBlank() || norm(title) != norm(allowed)) return@execute
                val messages = Notification.MessagingStyle.Message.getMessagesFromBundleArray(e.getParcelableArray(Notification.EXTRA_MESSAGES))
                val items = mutableListOf<Triple<String, String, Long>>()
                messages.forEach { m -> items.add(Triple(m.text?.toString().orEmpty(), (if (Build.VERSION.SDK_INT >= 28) m.senderPerson?.name?.toString() else m.sender?.toString()) ?: title, m.timestamp.takeIf { it > 0 } ?: sbn.postTime)) }
                if (items.isEmpty()) {
                    val lines = e.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
                    if (!lines.isNullOrEmpty()) lines.forEach { items.add(Triple(it.toString(), title, n.`when`.takeIf { t -> t > 0 } ?: sbn.postTime)) }
                    else {
                        val text = e.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: e.getCharSequence(Notification.EXTRA_TEXT)
                        if (text != null) items.add(Triple(text.toString(), title, n.`when`.takeIf { it > 0 } ?: sbn.postTime))
                    }
                }
                synchronized(lock) {
                    val inbox = JSONArray(prefs.getString("inbox", "[]"))
                    val seen = JSONObject(prefs.getString("seen", "{}") ?: "{}")
                    val now = System.currentTimeMillis()
                    val day = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.ROOT).format(java.util.Date(now))
                    var captured = if (prefs.getString("day", "") == day) prefs.getInt("captured", 0) else 0
                    var duplicates = if (prefs.getString("day", "") == day) prefs.getInt("duplicates", 0) else 0
                    for ((text, sender, time) in items) {
                        if (text.isBlank() || Regex("^(\\d+ )?(novas? mensagens?|mensagens?)( de .*)?$|^(procurando|verificando) novas mensagens", RegexOption.IGNORE_CASE).containsMatchIn(norm(text))) continue
                        val identity = listOf(sbn.packageName, title, sender, norm(text), sbn.key, sbn.id, sbn.tag, time / 1000).joinToString("|")
                        val id = MessageDigest.getInstance("SHA-256").digest(identity.toByteArray()).joinToString("") { "%02x".format(it) }
                        if (seen.has(id)) { duplicates++; continue }
                        inbox.put(JSONObject().put("id", id).put("packageName", sbn.packageName).put("conversationId", sbn.packageName + ":" + title)
                            .put("sender", sender).put("text", text).put("timestamp", time).put("capturedAt", now)
                            .put("subText", e.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty()))
                        seen.put(id, now); captured++
                    }
                    val keys = seen.keys().asSequence().toList()
                    keys.filter { now - seen.optLong(it) > 7 * 86400000L }.forEach { seen.remove(it) }
                    if (!prefs.edit().putString("inbox", inbox.toString()).putString("seen", seen.toString()).putString("day", day)
                        .putInt("captured", captured).putInt("duplicates", duplicates).putLong("lastNotification", now)
                        .putString("lastConversation", title).putLong("processingMs", (System.nanoTime()-start)/1000000).commit()) throw IllegalStateException("Persistencia")
                }
                onCaptured?.invoke()
            } catch (ex: Exception) { error(ex) }
        }
    }
    override fun onDestroy() { connected = false; worker.shutdown(); super.onDestroy() }
}
