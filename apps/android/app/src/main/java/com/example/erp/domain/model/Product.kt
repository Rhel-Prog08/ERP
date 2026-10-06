package com.example.erp.domain.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Product(
    val id: String,
    val sku: String,
    val name: String,
    val description: String,
    val category: String,
    val price: Double,
    val costPrice: Double,
    val stockQuantity: Int,
    val minStockLevel: Int,
    val unit: String,
    val imageUrl: String? = null
)

@JsonClass(generateAdapter = true)
data class InventoryItem(
    val id: String,
    val productId: String,
    val productName: String,
    val sku: String,
    val quantityOnHand: Int,
    val reorderPoint: Int,
    val location: String,
    val status: InventoryStatus
)
