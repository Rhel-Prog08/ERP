package com.codeevo.erp.data.network

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter

/**
 * Referencia a un documento ObjectId del backend.
 *
 * El backend devuelve estas referencias en dos formas según el contexto:
 *  - Listado/consulta poblada: { "_id": "...", "name": "...", ... }
 *  - Creación / documento no poblado: "507f1f77bcf86cd799439011"
 *  - A veces sin prefijo _id: { "name": "..." } (sub-proyecciones)
 *
 * Este data class + adapter toleran ambas formas sin romper el parseo.
 */
data class Ref(
    val id: String = "",
    val name: String? = null,
    val code: String? = null,
    val email: String? = null
)

object RefJsonAdapter : JsonAdapter<Ref>() {

    override fun fromJson(reader: JsonReader): Ref? {
        return when (reader.peek()) {
            JsonReader.Token.NULL -> {
                reader.nextNull<Any>()
                null
            }
            JsonReader.Token.STRING -> Ref(id = reader.nextString())
            JsonReader.Token.BEGIN_OBJECT -> {
                var id = ""
                var name: String? = null
                var code: String? = null
                var email: String? = null
                reader.beginObject()
                while (reader.hasNext()) {
                    when (val field = reader.nextName()) {
                        "_id", "id" -> id = reader.nextString()
                        "name" -> name = reader.nextString()
                        "email" -> email = reader.nextString()
                        "customerCode", "supplierCode" -> code = reader.nextString()
                        "firstName", "lastName" -> {
                            // Referencias de usuario: firstName/lastName → nombre completo.
                            val part = reader.nextString()
                            name = listOfNotNull(name, part).joinToString(" ").ifBlank { null }
                        }
                        else -> reader.skipValue()
                    }
                }
                reader.endObject()
                Ref(id = id, name = name, code = code, email = email)
            }
            else -> {
                reader.skipValue()
                null
            }
        }
    }

    override fun toJson(writer: JsonWriter, value: Ref?) {
        if (value == null) writer.nullValue() else writer.value(value.id)
    }
}
