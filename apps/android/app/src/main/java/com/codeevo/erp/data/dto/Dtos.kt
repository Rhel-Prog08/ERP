package com.codeevo.erp.data.dto

import com.codeevo.erp.data.network.Ref
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/*
 * DTOs de red — reflejan EXACTAMENTE el JSON devuelto por el backend
 * CodeEvo (apps/backend): claves `_id` en documentos lean, poblamientos
 * como referencias `Ref`, listados como { items, pagination } y respuestas
 * envueltas en { success, data } (ver data.network.ApiEnvelope).
 */

/* --------------------------------- Base --------------------------------- */

@JsonClass(generateAdapter = true)
data class PagedDto<T>(
    val items: List<T> = emptyList(),
    val pagination: PaginationDto? = null
)

@JsonClass(generateAdapter = true)
data class PaginationDto(
    val page: Int = 1,
    val limit: Int = 20,
    val total: Long = 0,
    val totalPages: Int = 1
)

/* --------------------------------- Auth --------------------------------- */

@JsonClass(generateAdapter = true)
data class LoginRequestDto(
    val email: String,
    val password: String
)

@JsonClass(generateAdapter = true)
data class RefreshTokenRequestDto(
    val refreshToken: String
)

@JsonClass(generateAdapter = true)
data class LogoutRequestDto(
    val refreshToken: String? = null
)

@JsonClass(generateAdapter = true)
data class LogoutResponseDto(
    val message: String? = null
)

/** Respuesta de POST /auth/login y POST /auth/refresh. */
@JsonClass(generateAdapter = true)
data class AuthSessionDto(
    val user: UserDto,
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Int? = null
)

/** serializeUser(): { id, firstName, lastName, email, status, company{...}, role{...} }. */
@JsonClass(generateAdapter = true)
data class UserDto(
    val id: String,
    val firstName: String = "",
    val lastName: String = "",
    val email: String = "",
    val status: String = "active",
    val company: CompanyRefDto? = null,
    val role: RoleRefDto? = null
)

@JsonClass(generateAdapter = true)
data class CompanyRefDto(
    val id: String = "",
    val name: String = ""
)

@JsonClass(generateAdapter = true)
data class RoleRefDto(
    val id: String = "",
    val name: String = "",
    val permissions: List<String> = emptyList()
)

/* ------------------------------ Usuarios -------------------------------- */

/** GET /users — documento lean con roleId poblado ('name'). */
@JsonClass(generateAdapter = true)
data class UserListItemDto(
    @Json(name = "_id") val id: String,
    val firstName: String = "",
    val lastName: String = "",
    val email: String = "",
    val status: String = "active",
    val roleId: Ref? = null,
    val companyId: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateUserRequestDto(
    val firstName: String,
    val lastName: String,
    val email: String,
    val password: String,
    val roleId: String,
    val status: String? = null
)

@JsonClass(generateAdapter = true)
data class UpdateUserRequestDto(
    val firstName: String? = null,
    val lastName: String? = null,
    val email: String? = null,
    val roleId: String? = null,
    val status: String? = null,
    val newPassword: String? = null
)

/** GET /roles — arreglo simple (NO paginado) de la empresa del token. */
@JsonClass(generateAdapter = true)
data class RoleDto(
    @Json(name = "_id") val id: String,
    val name: String = "",
    val permissions: List<String> = emptyList(),
    val isSystem: Boolean = false,
    val status: String = "active"
)

@JsonClass(generateAdapter = true)
data class RoleUpdateRequestDto(
    val permissions: List<String>? = null,
    val name: String? = null,
    val status: String? = null
)

/* ------------------------------ Catálogo -------------------------------- */

@JsonClass(generateAdapter = true)
data class ProductDto(
    @Json(name = "_id") val id: String,
    val sku: String = "",
    val name: String = "",
    val description: String? = null,
    val categoryId: Ref? = null,
    val supplierId: Ref? = null,
    val purchasePrice: Double = 0.0,
    val salePrice: Double = 0.0,
    val stockMin: Double = 0.0,
    val unit: String = "unidad",
    val status: String = "active"
)

@JsonClass(generateAdapter = true)
data class CreateProductRequestDto(
    val sku: String,
    val name: String,
    val description: String? = null,
    val categoryId: String,
    val supplierId: String? = null,
    val purchasePrice: Double,
    val salePrice: Double,
    val stockMin: Double? = null,
    val unit: String? = null,
    val status: String? = null
)

@JsonClass(generateAdapter = true)
data class UpdateProductRequestDto(
    val sku: String? = null,
    val name: String? = null,
    val description: String? = null,
    val categoryId: String? = null,
    val purchasePrice: Double? = null,
    val salePrice: Double? = null,
    val stockMin: Double? = null,
    val unit: String? = null,
    val status: String? = null
)

@JsonClass(generateAdapter = true)
data class CategoryDto(
    @Json(name = "_id") val id: String,
    val name: String = "",
    val description: String? = null,
    val status: String = "active"
)

@JsonClass(generateAdapter = true)
data class WarehouseDto(
    @Json(name = "_id") val id: String,
    val name: String = "",
    val status: String = "active"
)

/* ------------------------------ Inventario ------------------------------ */

/** GET /inventory — fila con producto/almacén agregados por $lookup. */
@JsonClass(generateAdapter = true)
data class BalanceDto(
    @Json(name = "_id") val id: String? = null,
    val quantity: Double = 0.0,
    val productId: Ref? = null,
    val warehouseId: Ref? = null,
    val product: BalanceProductDto? = null,
    val warehouse: BalanceWarehouseDto? = null
)

@JsonClass(generateAdapter = true)
data class BalanceProductDto(
    val sku: String? = null,
    val name: String? = null,
    val unit: String? = null,
    val stockMin: Double? = null,
    val status: String? = null
)

@JsonClass(generateAdapter = true)
data class BalanceWarehouseDto(
    val name: String? = null
)

/** GET /inventory/movements — documento con producto/almacén/usuario poblados. */
@JsonClass(generateAdapter = true)
data class MovementDto(
    @Json(name = "_id") val id: String,
    val type: String = "",
    val quantity: Double = 0.0,
    val previousQuantity: Double? = null,
    val newQuantity: Double? = null,
    val reason: String? = null,
    val referenceType: String? = null,
    val createdAt: String? = null,
    val productId: Ref? = null,
    val warehouseId: Ref? = null,
    val userId: Ref? = null
)

@JsonClass(generateAdapter = true)
data class CreateMovementRequestDto(
    val productId: String,
    val warehouseId: String,
    val type: String,
    val quantity: Double,
    val reason: String? = null
)

/* -------------------------- Clientes/Proveedores ------------------------ */

@JsonClass(generateAdapter = true)
data class CustomerDto(
    @Json(name = "_id") val id: String,
    val customerCode: String? = null,
    val name: String = "",
    val companyName: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val status: String = "active"
)

@JsonClass(generateAdapter = true)
data class CreateCustomerRequestDto(
    val name: String,
    val companyName: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val status: String? = null
)

@JsonClass(generateAdapter = true)
data class SupplierDto(
    @Json(name = "_id") val id: String,
    val supplierCode: String? = null,
    val name: String = "",
    val companyName: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val status: String = "active"
)

@JsonClass(generateAdapter = true)
data class CreateSupplierRequestDto(
    val name: String,
    val companyName: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val status: String? = null
)

/* --------------------------- Ventas y Compras --------------------------- */

@JsonClass(generateAdapter = true)
data class DocumentItemDto(
    val productId: String = "",
    val sku: String? = null,
    val name: String? = null,
    val quantity: Double = 0.0,
    val unitPrice: Double = 0.0,
    val subtotal: Double = 0.0
)

@JsonClass(generateAdapter = true)
data class SaleDto(
    @Json(name = "_id") val id: String,
    val customerId: Ref? = null,
    val warehouseId: Ref? = null,
    val createdBy: Ref? = null,
    val items: List<DocumentItemDto> = emptyList(),
    val subtotal: Double = 0.0,
    val tax: Double = 0.0,
    val total: Double = 0.0,
    val status: String = "DRAFT",
    val notes: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@JsonClass(generateAdapter = true)
data class PurchaseDto(
    @Json(name = "_id") val id: String,
    val supplierId: Ref? = null,
    val warehouseId: Ref? = null,
    val createdBy: Ref? = null,
    val items: List<DocumentItemDto> = emptyList(),
    val subtotal: Double = 0.0,
    val tax: Double = 0.0,
    val total: Double = 0.0,
    val status: String = "DRAFT",
    val notes: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateDocumentItemDto(
    val productId: String,
    val quantity: Double,
    val unitPrice: Double
)

@JsonClass(generateAdapter = true)
data class CreateSaleRequestDto(
    val customerId: String,
    val warehouseId: String,
    val items: List<CreateDocumentItemDto>,
    val notes: String? = null
)

@JsonClass(generateAdapter = true)
data class CreatePurchaseRequestDto(
    val supplierId: String,
    val warehouseId: String,
    val items: List<CreateDocumentItemDto>,
    val notes: String? = null
)

@JsonClass(generateAdapter = true)
data class CancelDocumentRequestDto(
    val cancelReason: String
)

/* ------------------------------- Dashboard ------------------------------ */

@JsonClass(generateAdapter = true)
data class DashboardDto(
    val kpi: DashboardKpiDto = DashboardKpiDto(),
    val recentSales: List<SaleDto> = emptyList(),
    val recentPurchases: List<PurchaseDto> = emptyList(),
    val lowStock: List<LowStockDto> = emptyList(),
    val salesByPeriod: List<SalesPointDto> = emptyList(),
    val topProducts: List<TopProductDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class DashboardKpiDto(
    val salesToday: Double = 0.0,
    val salesTodayCount: Int = 0,
    val salesMonth: Double = 0.0,
    val salesMonthCount: Int = 0,
    val purchasesMonth: Double = 0.0,
    val purchasesMonthCount: Int = 0,
    val totalProducts: Int = 0,
    val lowStockCount: Int = 0,
    val totalCustomers: Int = 0,
    val totalSuppliers: Int = 0
)

@JsonClass(generateAdapter = true)
data class LowStockDto(
    @Json(name = "_id") val id: String? = null,
    val sku: String? = null,
    val name: String? = null,
    val stockMin: Double = 0.0,
    val totalStock: Double = 0.0,
    val unit: String? = null
)

@JsonClass(generateAdapter = true)
data class SalesPointDto(
    val date: String? = null,
    val total: Double = 0.0,
    val count: Int = 0
)

@JsonClass(generateAdapter = true)
data class TopProductDto(
    val productId: String? = null,
    val sku: String? = null,
    val name: String? = null,
    val quantity: Double = 0.0,
    val revenue: Double = 0.0
)

/* ------------------------------- Auditoría ------------------------------ */

/** GET /audit — auditoría inmutable con usuario poblado. */
@JsonClass(generateAdapter = true)
data class AuditItemDto(
    @Json(name = "_id") val id: String,
    val userId: Ref? = null,
    val action: String = "",
    val module: String? = null,
    val entity: String? = null,
    val entityId: String? = null,
    val previousValue: Any? = null,
    val newValue: Any? = null,
    val description: String? = null,
    val ip: String? = null,
    val createdAt: String? = null
)

/* -------------------------------- Reportes ------------------------------ */

/** GET /reports/<tipo> → { report, count, rows:[filas planas en español] }. */
@JsonClass(generateAdapter = true)
data class ReportEnvelopeDto(
    val report: String? = null,
    val count: Int? = null,
    val rows: List<ReportRowDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class ReportRowDto(
    val fecha: String? = null,
    val estado: String? = null,
    val subtotal: Double? = null,
    val total: Double? = null,
    val sku: String? = null,
    val categoria: String? = null
)

/* --------------------------- Empresa / Ajustes -------------------------- */

/** GET /companies — documento propio (una petición por empresa). */
@JsonClass(generateAdapter = true)
data class CompanyDto(
    @Json(name = "_id") val id: String,
    val name: String = "",
    val legalName: String? = null,
    val taxId: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val address: String? = null,
    val status: String = "active"
)

@JsonClass(generateAdapter = true)
data class UpdateCompanyRequestDto(
    val name: String? = null,
    val legalName: String? = null,
    val taxId: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val address: String? = null
)

@JsonClass(generateAdapter = true)
data class SettingsDto(
    val id: String? = null,
    val companyId: String? = null,
    val taxRate: Double = 0.0,
    val allowNegativeStock: Boolean = false,
    val updatedAt: String? = null
)

@JsonClass(generateAdapter = true)
data class UpdateSettingsRequestDto(
    val taxRate: Double? = null,
    val allowNegativeStock: Boolean? = null
)
