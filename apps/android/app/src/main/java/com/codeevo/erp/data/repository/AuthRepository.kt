package com.codeevo.erp.data.repository

import com.codeevo.erp.data.dto.LogoutRequestDto
import com.codeevo.erp.data.dto.LoginRequestDto
import com.codeevo.erp.data.local.TokenRepository
import com.codeevo.erp.data.mapper.toDomain
import com.codeevo.erp.data.network.ErpApiService
import com.codeevo.erp.data.network.unwrap
import com.codeevo.erp.domain.model.User
import kotlinx.coroutines.flow.Flow

/**
 * Sesión real contra POST /auth/login, POST /auth/refresh (vía interceptor),
 * GET /auth/me y POST /auth/logout.
 *
 * El login fallido devuelve `Result.failure` con el mensaje real del backend
 * (401 "Credenciales inválidas", bloqueo, etc.): NO existe ningún fallback
 * con datos inventados.
 */
class AuthRepository(
    private val apiService: ErpApiService,
    private val tokenRepository: TokenRepository
) {

    val currentUser: Flow<User?> = tokenRepository.userSession
    val isLoggedIn: Flow<Boolean> = tokenRepository.isLoggedIn

    suspend fun login(email: String, password: String): Result<User> = apiResult {
        val session = apiService.login(LoginRequestDto(email, password)).unwrap()
        tokenRepository.saveAuthToken(session.accessToken, session.refreshToken)

        // GET /auth/me con el access token recién emitido: refina la sesión con
        // el perfil/permisos vigentes; si fallara, se conserva el usuario del login.
        val user = runCatching { apiService.getCurrentUser().unwrap().toDomain() }
            .getOrElse { session.toDomain() }

        tokenRepository.saveUserSession(user)
        user
    }

    /** Logout idempotente: revoca el refresh token en el servidor y limpia la sesión local. */
    suspend fun logout(): Result<Unit> {
        return try {
            val refreshToken = tokenRepository.getRefreshTokenDirect()
            apiService.logout(LogoutRequestDto(refreshToken)).unwrap()
            tokenRepository.clearSession()
            Result.success(Unit)
        } catch (e: Exception) {
            // Aunque falle la red, la sesión local SIEMPRE se cierra.
            tokenRepository.clearSession()
            Result.success(Unit)
        }
    }
}
