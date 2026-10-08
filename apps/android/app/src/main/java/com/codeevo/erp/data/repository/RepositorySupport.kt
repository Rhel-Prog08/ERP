package com.codeevo.erp.data.repository

import com.codeevo.erp.data.dto.PagedDto
import com.codeevo.erp.data.dto.WarehouseDto
import com.codeevo.erp.data.network.ApiEnvelope
import com.codeevo.erp.data.network.ApiException
import com.codeevo.erp.data.network.ErpApiService
import com.codeevo.erp.data.network.unwrap
import retrofit2.Response

/**
 * Soporte común de los repositorios:
 *  - [apiResult]: captura errores del servidor ([ApiException] con el mensaje
 *    real del backend) y de red, devolviendo siempre `Result` para la UI.
 *  - [fetchAllPages]: recorre la paginación { items, pagination } del backend
 *    hasta agotar las páginas (los listados de la UI son completos).
 */

internal suspend fun <T> apiResult(block: suspend () -> T): Result<T> = try {
    Result.success(block())
} catch (e: ApiException) {
    Result.failure(e)
} catch (e: Exception) {
    Result.failure(Exception(e.message ?: "Error de conexión con el servidor"))
}

/** Límite de seguridad: 50 páginas × 100 = 5.000 documentos por listado. */
private const val MAX_PAGES = 50
private const val PAGE_SIZE = 100

internal suspend fun <T> fetchAllPages(
    fetch: suspend (page: Int, limit: Int) -> Response<ApiEnvelope<PagedDto<T>>>
): List<T> {
    val all = mutableListOf<T>()
    var page = 1
    while (page <= MAX_PAGES) {
        val paged = fetch(page, PAGE_SIZE).unwrap()
        all += paged.items
        val totalPages = paged.pagination?.totalPages ?: 1
        if (paged.items.isEmpty() || page >= totalPages) break
        page += 1
    }
    return all
}

/**
 * Almacén activo por defecto: el backend exige `warehouseId` en ventas,
 * compras y movimientos de inventario. La UI no tiene selector de almacén,
 * así que se usa el primero activo de la empresa (Almacén Principal en la
 * aprovisionación automática).
 */
internal suspend fun ErpApiService.defaultWarehouse(): WarehouseDto {
    val warehouses = fetchAllPages { page, limit -> getWarehouses(page, limit, status = "active") }
    return warehouses.firstOrNull { it.status == "active" }
        ?: warehouses.firstOrNull()
        ?: throw ApiException(
            "NO_WAREHOUSE",
            "La empresa no tiene almacenes; cree uno antes de registrar operaciones"
        )
}
