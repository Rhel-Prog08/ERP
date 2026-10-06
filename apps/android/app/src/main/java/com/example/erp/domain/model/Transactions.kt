package com.example.erp.domain.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class SaleItem(
    val productId: String,
    val productName: String,
    val quantity: Int,
    val unitPrice: Double,
    val subtotal: Double
)

@JsonClass(generateAdapter = true)
data class Sale(
    val id: String,
    val saleNumber: String,
    val customerId: String,
    val customerName: String,
    val items: List<SaleItem>,
    val totalAmount: Double,
    val date: Long,
    val status: DocumentStatus
)

@JsonClass(generateAdapter = true)
data class PurchaseItem(
    val productId: String,
    val productName: String,
    val quantity: Int,
    val unitPrice: Double,
    val subtotal: Double
)

@JsonClass(generateAdapter = true)
data class Purchase(
    val id: String,
    val purchaseNumber: String,
    val supplierId: String,
    val supplierName: String,
    val items: List<PurchaseItem>,
    val totalAmount: Double,
    val date: Long,
    val status: DocumentStatus
)
