package com.codeevo.erp.data

import com.codeevo.erp.data.dto.AuthSessionDto
import com.codeevo.erp.data.dto.LoginRequestDto
import com.codeevo.erp.data.dto.PagedDto
import com.codeevo.erp.data.dto.ProductDto
import com.codeevo.erp.data.dto.RoleDto
import com.codeevo.erp.data.dto.UserListItemDto
import com.codeevo.erp.data.network.ApiEnvelope
import com.codeevo.erp.data.network.ApiException
import com.codeevo.erp.data.network.ApiJson
import com.codeevo.erp.data.network.Ref
import com.codeevo.erp.data.network.httpError
import com.codeevo.erp.data.network.unwrap
import com.codeevo.erp.domain.model.DocumentStatus
import com.codeevo.erp.domain.model.Permission
import com.codeevo.erp.domain.model.applyPermissionToggles
import com.codeevo.erp.domain.model.backendKeys
import com.codeevo.erp.domain.model.documentStatusFromBackend
import com.codeevo.erp.domain.model.movementTypeFromBackend
import com.codeevo.erp.domain.model.movementTypeToBackend
import com.codeevo.erp.domain.model.permissionsFromKeys
import com.codeevo.erp.domain.model.roleFromBackendName
import com.codeevo.erp.domain.model.toBackend
import com.codeevo.erp.domain.model.toBackendName
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

/**
 * Pruebas del contrato cliente ↔ backend CodeEvo (sin red):
 * envelope {success,data}, errores {success:false,error}, referencias
 * ObjectId (string u objeto), paginación y mapeos enum ↔ claves reales.
 */
class ApiContractTest {

    private val moshi = ApiJson.moshi

    /* ------------------------------ Envelope ------------------------------ */

    @Test
    fun `unwrap extrae data del sobre de exito`() {
        val json = """{"success":true,"data":{"id":"u1","firstName":"Ana","lastName":"Pérez"}}"""
        val envelopeType = com.squareup.moshi.Types.newParameterizedType(
            ApiEnvelope::class.java,
            com.squareup.moshi.Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java)
        )
        val parsed = moshi.adapter<ApiEnvelope<Map<String, Any?>>>(envelopeType).fromJson(json)!!
        val response: Response<ApiEnvelope<Map<String, Any?>>> = Response.success(parsed)

        val data = response.unwrap()
        assertEquals("u1", data["id"])
        assertEquals("Ana", data["firstName"])
        assertTrue(parsed.success)
        assertNull(parsed.error)
    }

    @Test
    fun `unwrap lanza ApiException con el mensaje real del backend`() {
        val json = """{"success":false,"error":{"code":"AUTHENTICATION_ERROR","message":"Credenciales inválidas"}}"""
        val envelopeType = com.squareup.moshi.Types.newParameterizedType(
            ApiEnvelope::class.java,
            com.squareup.moshi.Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java)
        )
        val parsed = moshi.adapter<ApiEnvelope<Map<String, Any?>>>(envelopeType).fromJson(json)!!
        val response: Response<ApiEnvelope<Map<String, Any?>>> = Response.success(parsed)

        try {
            response.unwrap()
            throw AssertionError("Debía lanzar ApiException")
        } catch (e: ApiException) {
            assertEquals("AUTHENTICATION_ERROR", e.code)
            assertEquals("Credenciales inválidas", e.message)
        }
    }

    @Test
    fun `httpError lee el sobre de error del errorBody`() {
        val body =
            """{"success":false,"error":{"code":"AUTHORIZATION_ERROR","message":"Permiso denegado"}}"""
            .toResponseBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val response: Response<Unit> = Response.error(403, body)
        val error = response.httpError(403)
        assertEquals("AUTHORIZATION_ERROR", error.code)
        assertEquals("Permiso denegado", error.message)
    }

    /* --------------------------------- Ref -------------------------------- */

    @Test
    fun `Ref parsea ObjectId como cadena simple`() {
        val adapter = moshi.adapter(Ref::class.java)
        val ref = adapter.fromJson("\"507f1f77bcf86cd799439011\"")!!
        assertEquals("507f1f77bcf86cd799439011", ref.id)
        assertNull(ref.name)
    }

    @Test
    fun `Ref parsea objeto poblado con nombre y codigo`() {
        val adapter = moshi.adapter(Ref::class.java)
        val ref = adapter.fromJson("""{"_id":"abc123","name":"Almacén Principal"}""")!!
        assertEquals("abc123", ref.id)
        assertEquals("Almacén Principal", ref.name)
    }

    @Test
    fun `Ref parsea referencias de usuario pobladas firstName lastName`() {
        val adapter = moshi.adapter(Ref::class.java)
        val ref = adapter.fromJson("""{"_id":"u9","firstName":"Ana","lastName":"Pérez","email":"a@x.mx"}""")!!
        assertEquals("u9", ref.id)
        assertEquals("Ana Pérez", ref.name)
        assertEquals("a@x.mx", ref.email)
    }

    @Test
    fun `Ref tolera null`() {
        val adapter = moshi.adapter(Ref::class.java)
        assertNull(adapter.fromJson("null"))
    }

    /* ------------------------- DTOs con JSON real -------------------------- */

    @Test
    fun `AuthSessionDto parsea la respuesta real del login`() {
        val json = """
            {
              "user": {
                "id": "665f0a1a2b3c4d5e6f708090",
                "firstName": "Admin",
                "lastName": "Demo",
                "email": "admin@demo.local",
                "status": "active",
                "company": {"id": "665f0a1a2b3c4d5e6f708091", "name": "Empresa Demo"},
                "role": {"id": "665f0a1a2b3c4d5e6f708092", "name": "Administrador", "permissions": ["products.read","sales.create"]}
              },
              "accessToken": "jwt.access.token",
              "refreshToken": "jwt.refresh.token",
              "expiresIn": 900
            }
        """.trimIndent()
        val session = moshi.adapter(AuthSessionDto::class.java).fromJson(json)!!
        assertEquals("jwt.access.token", session.accessToken)
        assertEquals("jwt.refresh.token", session.refreshToken)
        assertEquals(900, session.expiresIn)
        assertEquals("Admin", session.user.firstName)
        assertEquals("Empresa Demo", session.user.company?.name)
        assertEquals("Administrador", session.user.role?.name)
        assertEquals(listOf("products.read", "sales.create"), session.user.role?.permissions)
    }

    @Test
    fun `PagedDto parsea listado con paginacion del crudFactory`() {
        val json = """
            {
              "items": [
                {"_id":"p1","sku":"SKU-1","name":"Laptop","salePrice":999.5,"purchasePrice":700.0,"stockMin":5,"unit":"unidad","status":"active"}
              ],
              "pagination": {"page":1,"limit":100,"total":1,"totalPages":1}
            }
        """.trimIndent()
        val type = com.squareup.moshi.Types.newParameterizedType(PagedDto::class.java, ProductDto::class.java)
        val paged = moshi.adapter<PagedDto<ProductDto>>(type).fromJson(json)!!
        assertEquals(1, paged.items.size)
        assertEquals("SKU-1", paged.items[0].sku)
        assertEquals(999.5, paged.items[0].salePrice, 0.001)
        assertEquals(1, paged.pagination?.totalPages)
        assertEquals(1L, paged.pagination?.total)
    }

    @Test
    fun `UserListItemDto parsea roleId poblado con nombre del rol`() {
        val json = """
            {"_id":"u1","firstName":"Lucía","lastName":"Ríos","email":"l@x.mx","status":"active",
             "roleId":{"_id":"r1","name":"Ventas"}}
        """.trimIndent()
        val user = moshi.adapter(UserListItemDto::class.java).fromJson(json)!!
        assertEquals("u1", user.id)
        assertEquals("Ventas", user.roleId?.name)
        assertEquals("r1", user.roleId?.id)
    }

    @Test
    fun `RoleDto parsea arreglo simple de GET roles`() {
        val json = """{"_id":"r2","name":"Administrador","permissions":["dashboard.read","users.read"],"isSystem":true}"""
        val role = moshi.adapter(RoleDto::class.java).fromJson(json)!!
        assertEquals("Administrador", role.name)
        assertTrue(role.isSystem)
        assertEquals(2, role.permissions.size)
    }

    @Test
    fun `LoginRequestDto serializa email y password exactos`() {
        val json = moshi.adapter(LoginRequestDto::class.java).toJson(
            LoginRequestDto("admin@demo.local", "Admin12345!")
        )
        assertTrue(json.contains("\"email\":\"admin@demo.local\""))
        assertTrue(json.contains("\"password\":\"Admin12345!\""))
    }

    /* ------------------------- Mapeos enum ↔ backend ----------------------- */

    @Test
    fun `roles de UI mapean a los nombres reales sembrados`() {
        assertEquals("Administrador", com.codeevo.erp.domain.model.Role.ADMIN.toBackendName())
        assertEquals("Gerente", com.codeevo.erp.domain.model.Role.MANAGER.toBackendName())
        assertEquals("Ventas", com.codeevo.erp.domain.model.Role.SALES.toBackendName())
        assertEquals("Almacén", com.codeevo.erp.domain.model.Role.INVENTORY.toBackendName())
        assertEquals("Compras", com.codeevo.erp.domain.model.Role.FINANCE.toBackendName())

        assertEquals(com.codeevo.erp.domain.model.Role.ADMIN, roleFromBackendName("Administrador"))
        assertEquals(com.codeevo.erp.domain.model.Role.SALES, roleFromBackendName("ventas"))
        assertEquals(com.codeevo.erp.domain.model.Role.MANAGER, roleFromBackendName("Rol inventado"))
    }

    @Test
    fun `permisos de UI se traducen a claves reales del catalogo`() {
        assertEquals(listOf("products.read"), Permission.READ_PRODUCTS.backendKeys)
        assertTrue(Permission.WRITE_PRODUCTS.backendKeys.containsAll(listOf("products.create", "products.update")))
        assertTrue(Permission.VIEW_FINANCES.backendKeys.contains("reports.read"))
        assertFalse(Permission.MANAGE_INVENTORY.backendKeys.contains("bogus.key"))
    }

    @Test
    fun `permissionsFromKeys detecta permisos por cualquier clave del grupo`() {
        val keys = listOf("sales.create", "sales.cancel", "customers.read", "unknown.module")
        val perms = permissionsFromKeys(keys)
        assertTrue(perms.contains(Permission.WRITE_SALES))
        assertFalse(perms.contains(Permission.READ_SALES))
        assertFalse(perms.contains(Permission.MANAGE_USERS))
    }

    @Test
    fun `applyPermissionToggles conserva claves sin equivalente en el enum`() {
        val raw = listOf("sales.read", "customers.read", "products.read", "branches.read")
        val enabled = listOf(Permission.READ_SALES, Permission.READ_PURCHASES)
        val result = applyPermissionToggles(raw, enabled)
        // claves ajenas al enum intactas
        assertTrue(result.contains("customers.read"))
        assertTrue(result.contains("branches.read"))
        // grupo activado completo
        assertTrue(result.contains("sales.read"))
        assertTrue(result.containsAll(Permission.READ_PURCHASES.backendKeys))
        // grupo desactivado fuera
        assertFalse(result.contains("products.read"))
    }

    @Test
    fun `estados de documento mapean RECEIVED y transiciones`() {
        assertEquals(DocumentStatus.COMPLETED, documentStatusFromBackend("RECEIVED"))
        assertEquals(DocumentStatus.COMPLETED, documentStatusFromBackend("COMPLETED"))
        assertEquals(DocumentStatus.CONFIRMED, documentStatusFromBackend("CONFIRMED"))
        assertEquals(DocumentStatus.DRAFT, documentStatusFromBackend("desconocido"))
        assertEquals("RECEIVED", DocumentStatus.COMPLETED.toBackend(purchases = true))
        assertEquals("COMPLETED", DocumentStatus.COMPLETED.toBackend(purchases = false))
        assertEquals("CANCELLED", DocumentStatus.CANCELLED.toBackend())
    }

    @Test
    fun `tipos de movimiento mapean entre UI y backend`() {
        assertEquals("ENTRY", movementTypeToBackend("ENTRADA"))
        assertEquals("EXIT", movementTypeToBackend("SALIDA"))
        assertEquals("ADJUSTMENT", movementTypeToBackend("AJUSTE"))
        assertEquals("RETURN", movementTypeToBackend("DEVOLUCIÓN"))
        assertEquals("RETURN", movementTypeToBackend("DEVOLUCION"))
        assertEquals("SALIDA", movementTypeFromBackend("EXIT"))
        assertEquals("DEVOLUCIÓN", movementTypeFromBackend("RETURN"))
    }

    /* --------------------------------- Fechas ------------------------------- */

    @Test
    fun `parseServerDate entiende ISO y el formato de los reportes`() {
        val iso = com.codeevo.erp.data.mapper.parseServerDate("2026-01-15T10:30:00.000Z")
        assertTrue(iso > 0)
        val report = com.codeevo.erp.data.mapper.parseServerDate("2026-01-15 10:30:00")
        assertEquals(iso, report)
        assertEquals(0L, com.codeevo.erp.data.mapper.parseServerDate(null))
        assertEquals(0L, com.codeevo.erp.data.mapper.parseServerDate("no-fecha"))
    }
}
