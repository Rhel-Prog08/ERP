package com.codeevo.erp.domain.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Customer(
    val id: String,
    val name: String,
    val email: String,
    val phone: String,
    val company: String,
    val address: String,
    val totalPurchases: Double = 0.0
)

@JsonClass(generateAdapter = true)
data class Supplier(
    val id: String,
    val name: String,
    val contactPerson: String,
    val email: String,
    val phone: String,
    val address: String,
    val categoriesSupplied: List<String> = emptyList()
)
