package com.example.erp.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.example.erp.domain.model.User
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

val Context.authDataStore: DataStore<Preferences> by preferencesDataStore(name = "auth_preferences")

class TokenRepository(private val context: Context) {

    private val tokenKey = stringPreferencesKey("jwt_token")
    private val refreshTokenKey = stringPreferencesKey("refresh_token")
    private val userSessionKey = stringPreferencesKey("user_session_json")

    private val moshi: Moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()
    private val userAdapter = moshi.adapter(User::class.java)

    val authToken: Flow<String?> = context.authDataStore.data.map { preferences ->
        preferences[tokenKey]
    }

    suspend fun getAuthTokenDirect(): String? {
        return context.authDataStore.data.map { preferences -> preferences[tokenKey] }.first()
    }

    val userSession: Flow<User?> = context.authDataStore.data.map { preferences ->
        val userJson = preferences[userSessionKey]
        if (!userJson.isNullOrEmpty()) {
            runCatching { userAdapter.fromJson(userJson) }.getOrNull()
        } else {
            null
        }
    }

    val isLoggedIn: Flow<Boolean> = authToken.map { !it.isNullOrBlank() }

    suspend fun saveAuthToken(token: String, refreshToken: String? = null) {
        context.authDataStore.edit { preferences ->
            preferences[tokenKey] = token
            if (refreshToken != null) {
                preferences[refreshTokenKey] = refreshToken
            }
        }
    }

    suspend fun saveUserSession(user: User) {
        val userJson = userAdapter.toJson(user)
        context.authDataStore.edit { preferences ->
            preferences[userSessionKey] = userJson
        }
    }

    suspend fun clearSession() {
        context.authDataStore.edit { preferences ->
            preferences.remove(tokenKey)
            preferences.remove(refreshTokenKey)
            preferences.remove(userSessionKey)
        }
    }
}
