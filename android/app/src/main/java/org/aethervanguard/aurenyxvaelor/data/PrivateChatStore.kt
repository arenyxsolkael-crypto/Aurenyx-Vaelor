package org.aethervanguard.aurenyxvaelor.data

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.aethervanguard.aurenyxvaelor.model.LocalChatMessage
import org.aethervanguard.aurenyxvaelor.model.PrivateConversation
import org.aethervanguard.aurenyxvaelor.model.PrivateWorkspacePayload
import java.io.File
import java.util.UUID

/**
 * Stores private chat history strictly inside the app's sandboxed internal filesDir
 * (excluded from cloud auto-backup and device transfer in AndroidManifest.xml).
 */
class PrivateChatStore(private val storageDirectory: File) {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val storeFile = File(storageDirectory, STORE_FILE_NAME)
    private val tempFile = File(storageDirectory, "$STORE_FILE_NAME.tmp")

    @Synchronized
    fun loadConversations(): List<PrivateConversation> {
        if (!storeFile.exists()) return emptyList()
        return try {
            val raw = storeFile.readText(Charsets.UTF_8)
            json.decodeFromString<PrivateWorkspacePayload>(raw).conversations
        } catch (_: Exception) {
            emptyList()
        }
    }

    @Synchronized
    fun appendMessage(
        conversationId: String?,
        message: LocalChatMessage,
        nowEpochMs: Long = System.currentTimeMillis()
    ): List<PrivateConversation> {
        val current = loadConversations().toMutableList()
        val existingIdx = conversationId?.let { id -> current.indexOfFirst { it.id == id } } ?: -1

        if (existingIdx >= 0) {
            val existing = current[existingIdx]
            val updated = existing.copy(
                messages = existing.messages + message,
                updatedAtEpochMs = nowEpochMs
            )
            current.removeAt(existingIdx)
            current.add(0, updated)
        } else {
            val titlePreview = message.content.trim().take(44).ifEmpty { "New Conversation" }
            val created = PrivateConversation(
                id = conversationId ?: "conv-${UUID.randomUUID()}",
                title = titlePreview,
                messages = listOf(message),
                updatedAtEpochMs = nowEpochMs
            )
            current.add(0, created)
        }

        persist(current)
        return current
    }

    @Synchronized
    fun renameConversation(
        conversationId: String,
        newTitle: String,
        nowEpochMs: Long = System.currentTimeMillis()
    ): List<PrivateConversation> {
        val sanitizedTitle = newTitle.trim().take(80).ifEmpty { "Untitled Chat" }
        val updated = loadConversations().map { conv ->
            if (conv.id == conversationId) {
                conv.copy(title = sanitizedTitle, updatedAtEpochMs = nowEpochMs)
            } else {
                conv
            }
        }
        persist(updated)
        return updated
    }

    @Synchronized
    fun setArchived(
        conversationId: String,
        archived: Boolean,
        nowEpochMs: Long = System.currentTimeMillis()
    ): List<PrivateConversation> {
        val updated = loadConversations().map { conv ->
            if (conv.id == conversationId) {
                conv.copy(archived = archived, updatedAtEpochMs = nowEpochMs)
            } else {
                conv
            }
        }
        persist(updated)
        return updated
    }

    @Synchronized
    fun deleteConversation(conversationId: String): List<PrivateConversation> {
        val remaining = loadConversations().filterNot { it.id == conversationId }
        persist(remaining)
        return remaining
    }

    @Synchronized
    fun wipeAllPrivateHistory(): List<PrivateConversation> {
        if (tempFile.exists()) {
            tempFile.delete()
        }
        if (storeFile.exists()) {
            storeFile.delete()
        }
        return emptyList()
    }

    private fun persist(conversations: List<PrivateConversation>) {
        if (!storageDirectory.exists()) {
            storageDirectory.mkdirs()
        }
        val payload = PrivateWorkspacePayload(
            schemaVersion = 1,
            conversations = conversations
        )
        tempFile.writeText(json.encodeToString(payload), Charsets.UTF_8)
        if (!tempFile.renameTo(storeFile)) {
            storeFile.writeText(tempFile.readText(Charsets.UTF_8), Charsets.UTF_8)
            tempFile.delete()
        }
    }

    companion object {
        const val STORE_FILE_NAME = "vaelor_private_store_v1.json"
    }
}
