package com.codeevo.erp.data.network

import com.codeevo.erp.data.dto.AuthSessionDto
import com.codeevo.erp.data.dto.RefreshTokenRequestDto
import com.codeevo.erp.data.local.TokenRepository
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Call
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import java.util.concurrent.TimeUnit

object ApiClient {

    /**
     * API real desplegada en Render. La URL YA incluye `/api/v1/`, así que las
     * rutas de [ErpApiService] son relativas a ese prefijo (auth/login, sales, …).
     */
    const val BASE_URL = "https://erp-eatk.onrender.com/api/v1/"

    /** Render en frío puede tardar bastante en despertar: timeouts holgados. */
    private const val CONNECT_TIMEOUT_SECONDS = 30L
    private const val READ_TIMEOUT_SECONDS = 60L

    private var apiService: ErpApiService? = null

    fun getApiService(tokenRepository: TokenRepository): ErpApiService {
        if (apiService == null) {
            val logging = HttpLoggingInterceptor().apply {
                // Sólo en builds de depuración y sin cuerpo/cabeceras: el nivel
                // BODY imprimiría el Authorization y los tokens en logcat.
                level = if (tokenRepository.isDebugBuild) {
                    HttpLoggingInterceptor.Level.BASIC
                } else {
                    HttpLoggingInterceptor.Level.NONE
                }
            }

            val okHttpClient = OkHttpClient.Builder()
                .addInterceptor(AuthInterceptor(tokenRepository))
                .addInterceptor(logging)
                .connectTimeout(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .readTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .writeTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .build()

            val retrofit = Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(okHttpClient)
                .addConverterFactory(MoshiConverterFactory.create(ApiJson.moshi))
                .build()

            apiService = retrofit.create(ErpApiService::class.java)
        }
        return apiService!!
    }
}

/**
 * Cliente dedicado al endpoint `auth/refresh`.
 *
 * Se construye SIN [AuthInterceptor] para romper cualquier ciclo: el refresh
 * viaja con el refresh token en el body, nunca con el access token caducado.
 */
internal object TokenRefresher {

    /** Sólo se usa desde el hilo de OkHttp (AuthInterceptor), de forma síncrona. */
    interface RefreshApi {
        @POST("auth/refresh")
        fun refresh(@Body request: RefreshTokenRequestDto): Call<ApiEnvelope<AuthSessionDto>>
    }

    @Volatile
    private var service: RefreshApi? = null

    private fun getService(): RefreshApi {
        return service ?: synchronized(this) {
            service ?: run {
                val client = OkHttpClient.Builder()
                    .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                    .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
                    .build()
                val retrofit = Retrofit.Builder()
                    .baseUrl(ApiClient.BASE_URL)
                    .client(client)
                    .addConverterFactory(MoshiConverterFactory.create(ApiJson.moshi))
                    .build()
                retrofit.create(RefreshApi::class.java).also { service = it }
            }
        }
    }

    /**
     * Rota el refresh token contra el backend. Devuelve la nueva sesión o null
     * si el refresh token ya no es válido (sesión muerta → logout local).
     */
    fun refresh(refreshToken: String): AuthSessionDto? {
        return try {
            val response = getService().refresh(RefreshTokenRequestDto(refreshToken)).execute()
            if (response.isSuccessful) response.unwrap() else null
        } catch (e: Exception) {
            null
        }
    }
}
