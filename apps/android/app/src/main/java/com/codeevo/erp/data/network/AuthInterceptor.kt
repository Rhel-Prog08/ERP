package com.codeevo.erp.data.network

import com.codeevo.erp.data.local.TokenRepository
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody

/**
 * Interceptor de autenticación con flujo completo de 401:
 *
 *  1. Adjunta `Authorization: Bearer <accessToken>` si existe.
 *  2. Si el backend responde 401 (token caducado) y hay refresh token,
 *     rota la sesión vía POST /auth/refresh (sólo UN reintento; cabecera
 *     [RETRY_HEADER] para evitar bucles) y reintenta con el access token nuevo.
 *  3. Si el refresh falla, la sesión local se limpia (logout) y se devuelve
 *     un 401 sintético con el sobre de error estándar para que los
 *     repositorios muestren "Sesión expirada".
 *
 * El refresco usa bloqueo simple (double-checked): si dos hilos reciben 401
 * a la vez, sólo uno rota el token y el otro reutiliza el ya guardado
 * (rotación del backend → reutilización de refresh = rechazo).
 */
class AuthInterceptor(private val tokenRepository: TokenRepository) : Interceptor {

    private val refreshLock = Any()

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val token = runBlocking { tokenRepository.getAuthTokenDirect() }

        val authedRequest = original.newBuilder().apply {
            if (!token.isNullOrBlank()) {
                header(AUTH_HEADER, "Bearer $token")
            }
            header("Accept", "application/json")
        }.build()

        val response = chain.proceed(authedRequest)

        // Sólo actúa en: 401 + había token + aún no se reintentó en esta request.
        if (response.code != 401 || token.isNullOrBlank() || original.header(RETRY_HEADER) != null) {
            return response
        }
        response.close()

        val newToken = refreshTokenOnce(token) ?: run {
            runBlocking { tokenRepository.clearSession() }
            return syntheticUnauthorized(authedRequest)
        }

        return chain.proceed(
            authedRequest.newBuilder()
                .header(AUTH_HEADER, "Bearer $newToken")
                .header(RETRY_HEADER, "1")
                .build()
        )
    }

    /**
     * Rota el refresh token de forma atómica. Si otro hilo ya refrescó mientras
     * esperaba el lock, devuelve el access token recién guardado sin repetir
     * la llamada (la rotación del backend invalida el refresh token usado).
     */
    private fun refreshTokenOnce(staleAccessToken: String): String? {
        synchronized(refreshLock) {
            return runBlocking {
                val storedAccess = tokenRepository.getAuthTokenDirect()
                if (!storedAccess.isNullOrBlank() && storedAccess != staleAccessToken) {
                    return@runBlocking storedAccess
                }
                val refreshToken = tokenRepository.getRefreshTokenDirect() ?: return@runBlocking null
                val session = TokenRefresher.refresh(refreshToken) ?: return@runBlocking null
                tokenRepository.saveAuthToken(session.accessToken, session.refreshToken)
                session.accessToken
            }
        }
    }

    /** 401 sintético con el sobre estándar del backend (sin extra round-trip). */
    private fun syntheticUnauthorized(request: Request): Response {
        val body =
            """{"success":false,"error":{"code":"AUTHENTICATION_ERROR","message":"Sesión expirada; vuelva a iniciar sesión"}}"""
        return Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .body(body.toResponseBody("application/json; charset=utf-8".toMediaType()))
            .build()
    }

    companion object {
        const val AUTH_HEADER = "Authorization"
        const val RETRY_HEADER = "X-Auth-Retry"
    }
}
