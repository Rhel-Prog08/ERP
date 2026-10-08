package com.codeevo.erp.data.network

import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.ResponseBody
import retrofit2.Response

/**
 * Sobre (envelope) estándar de la API CodeEvo:
 *   Éxito:  { "success": true,  "data": ... }
 *   Error:  { "success": false, "error": { "code", "message", "details"? } }
 *
 * Todas las respuestas del backend usan este formato; Retrofit parsea el
 * cuerpo contra [ApiEnvelope] y los repositorios llaman a [unwrap].
 */
@JsonClass(generateAdapter = true)
data class ApiEnvelope<T>(
    val success: Boolean = false,
    val data: T? = null,
    val error: ApiError? = null
)

@JsonClass(generateAdapter = true)
data class ApiError(
    val code: String? = null,
    val message: String? = null,
    val details: List<ApiErrorDetail>? = null
)

@JsonClass(generateAdapter = true)
data class ApiErrorDetail(
    val field: String? = null,
    val message: String? = null
)

/** Sólo el campo de error, para parsear `errorBody()` de respuestas no-2xx. */
@JsonClass(generateAdapter = true)
data class ApiErrorEnvelope(
    val success: Boolean? = null,
    val error: ApiError? = null
)

/**
 * Error de negocio devuelto por el servidor (o error HTTP sin cuerpo parseable).
 * El mensaje llega tal cual a la UI para que el usuario vea el error real.
 */
class ApiException(
    val code: String,
    override val message: String
) : Exception(message)

/** Moshi compartido: adapter tolerante para referencias ObjectId + Kotlin reflect. */
object ApiJson {
    val moshi: Moshi = Moshi.Builder()
        .add(Ref::class.java, RefJsonAdapter)
        .addLast(KotlinJsonAdapterFactory())
        .build()
}

/**
 * Extrae `data` del sobre de éxito o lanza [ApiException] con el error real
 * del servidor. En respuestas no-2xx parsea `errorBody()`.
 */
fun <T> Response<ApiEnvelope<T>>.unwrap(): T {
    if (!isSuccessful) throw httpError(code())
    val envelope = body()
        ?: throw ApiException("EMPTY_BODY", "Respuesta vacía del servidor (HTTP ${code()})")
    if (!envelope.success) {
        throw ApiException(
            envelope.error?.code ?: "UNKNOWN",
            envelope.error?.message ?: "Respuesta inválida del servidor"
        )
    }
    return envelope.data
        ?: throw ApiException("EMPTY_DATA", "El servidor no devolvió datos")
}

/** Construye una [ApiException] leyendo el sobre de error del `errorBody()`. */
fun Response<*>.httpError(fallbackCode: Int): ApiException {
    val body: ResponseBody? = try {
        errorBody()
    } catch (e: Exception) {
        null
    }
    val parsed: ApiError? = body?.string()?.let { text ->
        if (text.isBlank()) null
        else runCatching { ApiJson.moshi.adapter(ApiErrorEnvelope::class.java).fromJson(text) }.getOrNull()?.error
    }
    return if (parsed?.message != null) {
        ApiException(parsed.code ?: "HTTP_$fallbackCode", parsed.message)
    } else {
        ApiException("HTTP_$fallbackCode", "Error del servidor (HTTP $fallbackCode)")
    }
}
