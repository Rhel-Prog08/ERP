package com.example.erp.data.repository

import com.example.erp.data.network.ErpApiService
import com.example.erp.domain.model.InventoryItem
import com.example.erp.domain.model.InventoryStatus
import com.example.erp.domain.model.Product

data class InventoryMovement(
    val id: String,
    val productId: String,
    val productName: String,
    val type: String, // "ENTRADA", "SALIDA", "AJUSTE", "DEVOLUCION"
    val quantity: Int,
    val date: Long,
    val reason: String
)

class ProductRepository(
    private val apiService: ErpApiService
) {
    private val inMemoryProducts = mockProducts.toMutableList()
    private val inMemoryInventoryItems = mockInventoryItems.toMutableList()
    private val inMemoryMovements = mockMovements.toMutableList()

    suspend fun getProducts(): Result<List<Product>> {
        return try {
            val response = apiService.getProducts()
            if (response.isSuccessful && !response.body().isNullOrEmpty()) {
                Result.success(response.body()!!)
            } else {
                Result.success(inMemoryProducts)
            }
        } catch (e: Exception) {
            Result.success(inMemoryProducts)
        }
    }

    suspend fun getProductById(id: String): Result<Product?> {
        return try {
            val response = apiService.getProductById(id)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body())
            } else {
                Result.success(inMemoryProducts.find { it.id == id })
            }
        } catch (e: Exception) {
            Result.success(inMemoryProducts.find { it.id == id })
        }
    }

    suspend fun getInventoryItems(): Result<List<InventoryItem>> {
        return try {
            val response = apiService.getInventoryItems()
            if (response.isSuccessful && !response.body().isNullOrEmpty()) {
                Result.success(response.body()!!)
            } else {
                Result.success(inMemoryInventoryItems)
            }
        } catch (e: Exception) {
            Result.success(inMemoryInventoryItems)
        }
    }

    suspend fun getInventoryMovements(): Result<List<InventoryMovement>> {
        return Result.success(inMemoryMovements)
    }

    suspend fun addProduct(product: Product): Result<Product> {
        return try {
            val response = apiService.createProduct(product)
            if (response.isSuccessful && response.body() != null) {
                val newProduct = response.body()!!
                inMemoryProducts.add(0, newProduct)
                updateOrAddInventoryForProduct(newProduct)
                Result.success(newProduct)
            } else {
                inMemoryProducts.add(0, product)
                updateOrAddInventoryForProduct(product)
                Result.success(product)
            }
        } catch (e: Exception) {
            inMemoryProducts.add(0, product)
            updateOrAddInventoryForProduct(product)
            Result.success(product)
        }
    }

    suspend fun updateProduct(product: Product): Result<Product> {
        return try {
            val response = apiService.updateProduct(product.id, product)
            if (response.isSuccessful && response.body() != null) {
                val updated = response.body()!!
                val index = inMemoryProducts.indexOfFirst { it.id == product.id }
                if (index != -1) inMemoryProducts[index] = updated
                updateOrAddInventoryForProduct(updated)
                Result.success(updated)
            } else {
                val index = inMemoryProducts.indexOfFirst { it.id == product.id }
                if (index != -1) inMemoryProducts[index] = product
                updateOrAddInventoryForProduct(product)
                Result.success(product)
            }
        } catch (e: Exception) {
            val index = inMemoryProducts.indexOfFirst { it.id == product.id }
            if (index != -1) inMemoryProducts[index] = product
            updateOrAddInventoryForProduct(product)
            Result.success(product)
        }
    }

    suspend fun recordMovement(
        productId: String,
        type: String,
        quantity: Int,
        reason: String
    ): Result<InventoryMovement> {
        val prodIndex = inMemoryProducts.indexOfFirst { it.id == productId }
        val prod = if (prodIndex != -1) inMemoryProducts[prodIndex] else null
        val productName = prod?.name ?: "Producto #$productId"

        val movement = InventoryMovement(
            id = "mov_${System.currentTimeMillis()}",
            productId = productId,
            productName = productName,
            type = type,
            quantity = quantity,
            date = System.currentTimeMillis(),
            reason = reason
        )
        inMemoryMovements.add(0, movement)

        if (prod != null) {
            val newQty = when (type.uppercase()) {
                "ENTRADA", "DEVOLUCION" -> prod.stockQuantity + quantity
                "SALIDA" -> (prod.stockQuantity - quantity).coerceAtLeast(0)
                "AJUSTE" -> quantity
                else -> prod.stockQuantity
            }
            val updatedProd = prod.copy(stockQuantity = newQty)
            inMemoryProducts[prodIndex] = updatedProd
            updateOrAddInventoryForProduct(updatedProd)
        }

        return Result.success(movement)
    }

    private fun updateOrAddInventoryForProduct(product: Product) {
        val status = when {
            product.stockQuantity <= 0 -> InventoryStatus.OUT_OF_STOCK
            product.stockQuantity <= product.minStockLevel -> InventoryStatus.LOW
            else -> InventoryStatus.NORMAL
        }
        val invIndex = inMemoryInventoryItems.indexOfFirst { it.productId == product.id }
        if (invIndex != -1) {
            val existing = inMemoryInventoryItems[invIndex]
            inMemoryInventoryItems[invIndex] = existing.copy(
                quantityOnHand = product.stockQuantity,
                reorderPoint = product.minStockLevel,
                status = status
            )
        } else {
            inMemoryInventoryItems.add(
                InventoryItem(
                    id = "inv_${product.id}",
                    productId = product.id,
                    productName = product.name,
                    sku = product.sku,
                    quantityOnHand = product.stockQuantity,
                    reorderPoint = product.minStockLevel,
                    location = "Almacén Principal",
                    status = status
                )
            )
        }
    }

    companion object {
        val mockProducts = listOf(
            Product(
                id = "prod_001",
                sku = "SKU-1001",
                name = "CodeEvo Pro Workstation Tower",
                description = "High performance Intel Xeon ERP workstation with 64GB RAM.",
                category = "Hardware",
                price = 2499.99,
                costPrice = 1800.00,
                stockQuantity = 18,
                minStockLevel = 5,
                unit = "pcs"
            ),
            Product(
                id = "prod_002",
                sku = "SKU-1002",
                name = "Dell XPS 15 Enterprise",
                description = "15-inch 4K OLED Laptop for management teams.",
                category = "Hardware",
                price = 1899.50,
                costPrice = 1400.00,
                stockQuantity = 3,
                minStockLevel = 10,
                unit = "pcs"
            ),
            Product(
                id = "prod_003",
                sku = "SKU-1003",
                name = "Cisco Catalyst 9300 Switch",
                description = "48-port Gigabit PoE+ Managed Switch.",
                category = "Networking",
                price = 3200.00,
                costPrice = 2500.00,
                stockQuantity = 0,
                minStockLevel = 2,
                unit = "pcs"
            ),
            Product(
                id = "prod_004",
                sku = "SKU-1004",
                name = "CodeEvo ERP Cloud License (1 Year)",
                description = "Annual enterprise license key per user seat.",
                category = "Software",
                price = 450.00,
                costPrice = 50.00,
                stockQuantity = 999,
                minStockLevel = 10,
                unit = "seats"
            ),
            Product(
                id = "prod_005",
                sku = "SKU-1005",
                name = "Logitech MX Master 3S",
                description = "Ergonomic wireless mouse with quiet click switches.",
                category = "Peripherals",
                price = 99.99,
                costPrice = 65.00,
                stockQuantity = 42,
                minStockLevel = 15,
                unit = "pcs"
            )
        )

        val mockInventoryItems = listOf(
            InventoryItem(
                id = "inv_001",
                productId = "prod_001",
                productName = "CodeEvo Pro Workstation Tower",
                sku = "SKU-1001",
                quantityOnHand = 18,
                reorderPoint = 5,
                location = "Warehouse A - Rack 3",
                status = InventoryStatus.NORMAL
            ),
            InventoryItem(
                id = "inv_002",
                productId = "prod_002",
                productName = "Dell XPS 15 Enterprise",
                sku = "SKU-1002",
                quantityOnHand = 3,
                reorderPoint = 10,
                location = "Warehouse A - Shelf 12",
                status = InventoryStatus.LOW
            ),
            InventoryItem(
                id = "inv_003",
                productId = "prod_003",
                productName = "Cisco Catalyst 9300 Switch",
                sku = "SKU-1003",
                quantityOnHand = 0,
                reorderPoint = 2,
                location = "Warehouse B - Cage 1",
                status = InventoryStatus.OUT_OF_STOCK
            )
        )

        val mockMovements = listOf(
            InventoryMovement(
                id = "mov_001",
                productId = "prod_002",
                productName = "Dell XPS 15 Enterprise",
                type = "ENTRADA",
                quantity = 5,
                date = System.currentTimeMillis() - 86400000L * 2,
                reason = "Recepción de compra PO-2025-409"
            ),
            InventoryMovement(
                id = "mov_002",
                productId = "prod_001",
                productName = "CodeEvo Pro Workstation Tower",
                type = "SALIDA",
                quantity = 2,
                date = System.currentTimeMillis() - 86400000L * 1,
                reason = "Venta INV-2025-089"
            )
        )
    }
}
