package com.codeevo.erp.data.repository

import com.codeevo.erp.data.dto.CreateMovementRequestDto
import com.codeevo.erp.data.dto.CreateProductRequestDto
import com.codeevo.erp.data.dto.UpdateProductRequestDto
import com.codeevo.erp.data.mapper.toDomain
import com.codeevo.erp.data.network.ApiException
import com.codeevo.erp.data.network.ErpApiService
import com.codeevo.erp.data.network.unwrap
import com.codeevo.erp.domain.model.InventoryItem
import com.codeevo.erp.domain.model.Product
import com.codeevo.erp.domain.model.movementTypeToBackend

/** Movimiento de inventario de la UI (dominio). El backend lo llama igual. */
data class InventoryMovement(
    val id: String,
    val productId: String,
    val productName: String,
    val type: String, // "ENTRADA", "SALIDA", "AJUSTE", "DEVOLUCIÓN"
    val quantity: Int,
    val date: Long,
    val reason: String
)

/**
 * Productos e inventario contra el backend real:
 *  - GET/POST/PATCH /products (categoryId resuelto contra /categories).
 *  - GET /inventory → existencias por almacén (merge al stock del producto).
 *  - GET/POST /inventory/movements → historial y movimientos manuales.
 *
 * El stock REAL vive en `stockBalances`: `getProducts` lo mergea con
 * GET /inventory para que la UI filtre por existencias verdaderas.
 */
class ProductRepository(
    private val apiService: ErpApiService
) {

    /* ------------------------------- Productes ------------------------------ */

    suspend fun getProducts(): Result<List<Product>> = apiResult {
        val products = fetchAllPages { page, limit -> apiService.getProducts(page, limit) }
        val categoryNames = resolveCategoryNames() // categoríaId → nombre
        val stockByProduct = fetchStockByProduct()
        products.map { dto ->
            dto.toDomain(
                stockQuantity = stockByProduct[dto.id]?.toInt() ?: 0,
                categoryName = dto.categoryId?.id?.let { categoryNames[it] }
            )
        }
    }

    suspend fun getProductById(id: String): Result<Product?> = apiResult {
        val categoryNames = resolveCategoryNames()
        val dto = apiService.getProduct(id).unwrap()
        dto.toDomain(categoryName = dto.categoryId?.id?.let { categoryNames[it] })
    }

    /** Nombres de categorías reales (el backend no popula categoryId en listados). */
    suspend fun getCategoryNames(): Result<List<String>> = apiResult {
        fetchAllPages { page, limit -> apiService.getCategories(page, limit) }
            .filter { it.status == "active" }
            .map { it.name }
            .distinct()
            .sorted()
    }

    /* ------------------------------- Inventario ----------------------------- */

    suspend fun getInventoryItems(): Result<List<InventoryItem>> = apiResult {
        fetchAllPages { page, limit -> apiService.getInventory(page, limit) }
            .map { it.toDomain() }
    }

    suspend fun getInventoryMovements(): Result<List<InventoryMovement>> = apiResult {
        fetchAllPages { page, limit -> apiService.getMovements(page, limit) }
            .map { it.toDomain() }
    }

    /**
     * POST /inventory/movements — el tipo de la UI se traduce al enum real
     * (ENTRY/EXIT/ADJUSTMENT/RETURN) y el almacén es el activo por defecto.
     * Para AJUSTMENT el backend interpreta `quantity` como la existencia
     * final absoluta (conteo físico), igual que el formulario de la UI.
     */
    suspend fun recordMovement(
        productId: String,
        type: String,
        quantity: Int,
        reason: String
    ): Result<InventoryMovement> = apiResult {
        val warehouse = apiService.defaultWarehouse()
        apiService.createMovement(
            CreateMovementRequestDto(
                productId = productId,
                warehouseId = warehouse.id,
                type = movementTypeToBackend(type),
                quantity = quantity.toDouble(),
                reason = reason.ifBlank { null }
            )
        ).unwrap().toDomain()
    }

    /* -------------------------------- Altas/edición ------------------------- */

    suspend fun addProduct(product: Product): Result<Product> = apiResult {
        val categoryId = resolveCategoryId(product.category)
        val created = apiService.createProduct(
            CreateProductRequestDto(
                sku = product.sku,
                name = product.name,
                description = product.description.ifBlank { null },
                categoryId = categoryId,
                purchasePrice = product.costPrice,
                salePrice = product.price,
                stockMin = product.minStockLevel.toDouble(),
                unit = normalizeUnit(product.unit)
            )
        ).unwrap()

        // Stock inicial (si se indicó): mejor esfuerzo con el almacén por
        // defecto. Si el usuario no tiene permiso o no hay almacén, el
        // producto queda creado con stock 0 y se registrará desde Inventario.
        if (product.stockQuantity > 0) {
            runCatching { recordMovement(created.id, "ENTRADA", product.stockQuantity, "Stock inicial") }
        }

        created.toDomain(stockQuantity = product.stockQuantity, categoryName = product.category.ifBlank { null })
    }

    suspend fun updateProduct(product: Product): Result<Product> = apiResult {
        val categoryId = resolveCategoryId(product.category)
        val updated = apiService.updateProduct(
            product.id,
            UpdateProductRequestDto(
                sku = product.sku,
                name = product.name,
                description = product.description.ifBlank { null },
                categoryId = categoryId,
                purchasePrice = product.costPrice,
                salePrice = product.price,
                stockMin = product.minStockLevel.toDouble(),
                unit = normalizeUnit(product.unit)
            )
        ).unwrap()
        updated.toDomain(
            stockQuantity = product.stockQuantity,
            categoryName = product.category.ifBlank { null }
        )
    }

    /* --------------------------------- Internos ----------------------------- */

    /** Existencia total por producto (todos los almacenes) desde /inventory. */
    private suspend fun fetchStockByProduct(): Map<String, Double> =
        try {
            fetchAllPages { page, limit -> apiService.getInventory(page, limit) }
                .filter { it.productId != null }
                .groupingBy { it.productId!!.id }
                .fold(0.0) { acc, balance -> acc + balance.quantity }
        } catch (e: Exception) {
            // Sin permiso/conexión a inventario: productos listados con stock 0
            // para no bloquear el módulo (la existencia real vive en Inventario).
            emptyMap()
        }

    /** id → nombre de categoría (products.categoryId NO viene poblado). */
    private suspend fun resolveCategoryNames(): Map<String, String> =
        try {
            fetchAllPages { page, limit -> apiService.getCategories(page, limit) }
                .associate { it.id to it.name }
        } catch (e: Exception) {
            emptyMap()
        }

    /** Nombre (del diálogo) → id real, con error claro si la categoría no existe. */
    private suspend fun resolveCategoryId(categoryName: String): String {
        if (categoryName.isBlank()) {
            throw ApiException("CATEGORY_REQUIRED", "Seleccione una categoría para el producto")
        }
        val categories = fetchAllPages { page, limit -> apiService.getCategories(page, limit) }
        val match = categories.firstOrNull { it.name.equals(categoryName.trim(), ignoreCase = true) }
            ?: throw ApiException(
                "CATEGORY_NOT_FOUND",
                "La categoría \"${categoryName.trim()}\" no existe; créela antes de guardar el producto"
            )
        return match.id
    }

    /** El backend sólo admite el enum UNITS: unidad, caja, kilo, litro, metro, pack. */
    private fun normalizeUnit(unit: String): String {
        val allowed = setOf("unidad", "caja", "kilo", "litro", "metro", "pack")
        val normalized = unit.trim().lowercase()
        return if (normalized in allowed) normalized else "unidad"
    }
}
