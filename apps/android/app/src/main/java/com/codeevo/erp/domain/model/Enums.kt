package com.codeevo.erp.domain.model

import com.squareup.moshi.Json

enum class Role {
    ADMIN,
    MANAGER,
    SALES,
    INVENTORY,
    FINANCE
}

enum class Permission {
    READ_PRODUCTS,
    WRITE_PRODUCTS,
    READ_SALES,
    WRITE_SALES,
    READ_PURCHASES,
    WRITE_PURCHASES,
    MANAGE_USERS,
    VIEW_FINANCES,
    MANAGE_INVENTORY
}

enum class InventoryStatus {
    @Json(name = "NORMAL") NORMAL,
    @Json(name = "LOW") LOW,
    @Json(name = "OUT_OF_STOCK") OUT_OF_STOCK
}

enum class DocumentStatus {
    @Json(name = "DRAFT") DRAFT,
    @Json(name = "CONFIRMED") CONFIRMED,
    @Json(name = "COMPLETED") COMPLETED,
    @Json(name = "CANCELLED") CANCELLED
}
