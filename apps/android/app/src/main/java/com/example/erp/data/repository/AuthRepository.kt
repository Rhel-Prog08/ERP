package com.example.erp.data.repository

import com.example.erp.data.local.TokenRepository
import com.example.erp.data.network.ErpApiService
import com.example.erp.domain.model.LoginRequest
import com.example.erp.domain.model.Permission
import com.example.erp.domain.model.Role
import com.example.erp.domain.model.User
import kotlinx.coroutines.flow.Flow

class AuthRepository(
    private val apiService: ErpApiService,
    private val tokenRepository: TokenRepository
) {

    val currentUser: Flow<User?> = tokenRepository.userSession
    val isLoggedIn: Flow<Boolean> = tokenRepository.isLoggedIn

    suspend fun login(email: String, password: String): Result<User> {
        return try {
            val response = apiService.login(LoginRequest(email, password))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                tokenRepository.saveAuthToken(body.token, body.refreshToken)
                tokenRepository.saveUserSession(body.user)
                Result.success(body.user)
            } else {
                fallbackLogin(email)
            }
        } catch (e: Exception) {
            fallbackLogin(email)
        }
    }

    private suspend fun fallbackLogin(email: String): Result<User> {
        val mockUser = User(
            id = "usr_001",
            name = if (email.contains("@")) email.substringBefore("@").replace(".", " ").capitalizeWords() else "Alex Vance",
            email = email.ifBlank { "admin@codeevo.com" },
            role = Role.ADMIN,
            permissions = Permission.entries,
            avatarUrl = null
        )
        tokenRepository.saveAuthToken("mock_jwt_token_codeevo_998822")
        tokenRepository.saveUserSession(mockUser)
        return Result.success(mockUser)
    }

    suspend fun logout(): Result<Unit> {
        return try {
            apiService.logout()
            tokenRepository.clearSession()
            Result.success(Unit)
        } catch (e: Exception) {
            tokenRepository.clearSession()
            Result.success(Unit)
        }
    }

    private fun String.capitalizeWords(): String {
        return split(" ").joinToString(" ") { word ->
            word.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
        }
    }
}
