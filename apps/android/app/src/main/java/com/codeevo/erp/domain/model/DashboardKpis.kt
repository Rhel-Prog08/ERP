package com.codeevo.erp.domain.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class DashboardKpis(
    val totalRevenue: Double,
    val revenueGrowthPercent: Double,
    val totalOrders: Int,
    val ordersGrowthPercent: Double,
    val lowStockItemsCount: Int,
    val activeCustomersCount: Int,
    val totalExpenses: Double,
    val netProfit: Double
)

@JsonClass(generateAdapter = true)
data class TopProduct(
    val id: String,
    val name: String,
    val category: String,
    val unitsSold: Int,
    val revenue: Double,
    val targetProgress: Float
)

@JsonClass(generateAdapter = true)
data class AuditLog(
    val id: String,
    val userId: String,
    val userName: String,
    val action: String,
    val targetModule: String,
    val timestamp: Long,
    val details: String,
    val payloadBefore: String? = null,
    val payloadAfter: String? = null
)
