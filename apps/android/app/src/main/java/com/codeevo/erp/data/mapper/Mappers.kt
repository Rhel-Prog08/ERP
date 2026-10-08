package com.codeevo.erp.data.mapper

import com.codeevo.erp.data.dto.AuditItemDto
import com.codeevo.erp.data.dto.AuthSessionDto
import com.codeevo.erp.data.dto.BalanceDto
import com.codeevo.erp.data.dto.CustomerDto
import com.codeevo.erp.data.dto.DashboardKpiDto
import com.codeevo.erp.data.dto.DocumentItemDto
import com.codeevo.erp.data.dto.LowStockDto
import com.codeevo.erp.data.dto.MovementDto
import com.codeevo.erp.data.dto.ProductDto
import com.codeevo.erp.data.dto.PurchaseDto
import com.codeevo.erp.data.dto.SaleDto
import com.codeevo.erp.data.dto.SupplierDto
import com.codeevo.erp.data.dto.TopProductDto
import com.codeevo.erp.data.dto.UserListItemDto
import com.codeevo.erp.data.repository.InventoryMovement
import com.codeevo.erp.domain.model.AuditLog
import com.codeevo.erp.domain.model.Customer
import com.codeevo.erp.domain.model.DashboardKpis
import com.codeevo.erp.domain.model.InventoryItem
import com.codeevo.erp.domain.model.InventoryStatus
import com.codeevo.erp.domain.model.Product
import com.codeevo.erp.domain.model.Purchase
import com.codeevo.erp.domain.model.Sale
import com.codeevo.erp.domain.model.SaleItem
import com.codeevo.erp.domain.model.Supplier
import com.codeevo.erp.domain.model.TopProduct
import com.codeevo.erp.domain.model.User
import com.codeevo.erp.domain.model.documentStatusFromBackend
import com.codeevo.erp.domain.model.movementTypeFromBackend
import com.codeevo.erp.domain.model.permissionsFromKeys
import com.codeevo.erp.domain.model.roleFromBackendName
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlin.math.roundToInt

/**
 * Normaliza el JSON real del backend a los modelos de dominio de la UI.
 * Campo por campo según apps/backend/src/modules (sin inventar nombres).
 */

/* --------------------------------- Fechas -------------------------------- */

private val isoFormats = listOf(
    "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
    "yyyy-MM-dd'T'HH:mm:ss'Z'",
    "yyyy-MM-dd HH:mm:ss"
)

/** Fecha ISO/`YYYY-MM-DD HH:mm:ss` → epoch millis (null ⇒ 0). */
fun parseServerDate(value: String?): Long {
    if (value.isNullOrBlank()) return 0L
    for (pattern in isoFormats) {
        try {
            val sdf = SimpleDateFormat(pattern, Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
                isLenient = false
            }
            return sdf.parse(value)?.time ?: continue
        } catch (e: Exception) {
            // probar siguiente formato
        }
    }
    return 0L
}

/* ---------------------------------- Auth --------------------------------- */

fun AuthSessionDto.toDomain(): User = user.toDomain()

fun com.codeevo.erp.data.dto.UserDto.toDomain(companyName: String = company?.name.orEmpty()): User {
    val roleName = role?.name.orEmpty()
    val rawPermissions = role?.permissions.orEmpty()
    return User(
        id = id,
        firstName = firstName,
        lastName = lastName,
        email = email,
        status = status,
        companyName = companyName.ifBlank { company?.name.orEmpty() },
        roleId = role?.id.orEmpty(),
        roleName = roleName,
        role = roleFromBackendName(roleName),
        permissions = permissionsFromKeys(rawPermissions),
        rawPermissions = rawPermissions
    )
}

/** GET /users (roleId poblado con 'name') + roles de la empresa. */
fun UserListItemDto.toDomain(rolesById: Map<String, com.codeevo.erp.data.dto.RoleDto>): User {
    val roleDto = roleId?.id?.let { rolesById[it] }
    val roleName = roleDto?.name ?: roleId?.name.orEmpty()
    val rawPermissions = roleDto?.permissions.orEmpty()
    return User(
        id = id,
        firstName = firstName,
        lastName = lastName,
        email = email,
        status = status,
        roleId = roleDto?.id ?: roleId?.id.orEmpty(),
        roleName = roleName,
        role = roleFromBackendName(roleName),
        permissions = permissionsFromKeys(rawPermissions),
        rawPermissions = rawPermissions
    )
}

/* -------------------------------- Catálogo -------------------------------- */

/** `stockQuantity` lo aporta el merge de balances de /inventory (ver repositorio);
 *  `categoryName` resuelve /categories porque el backend NO popula categoryId. */
fun ProductDto.toDomain(stockQuantity: Int = 0, categoryName: String? = null): Product = Product(
    id = id,
    sku = sku,
    name = name,
    description = description.orEmpty(),
    category = categoryName ?: categoryId?.name.orEmpty(),
    price = salePrice,
    costPrice = purchasePrice,
    stockQuantity = stockQuantity,
    minStockLevel = stockMin.roundToInt(),
    unit = unit
)

fun CustomerDto.toDomain(totalPurchases: Double = 0.0): Customer = Customer(
    id = id,
    name = name,
    email = email.orEmpty(),
    phone = phone.orEmpty(),
    // El backend no tiene "persona de contacto": companyName ocupa ese slot.
    company = companyName.orEmpty(),
    address = address.orEmpty(),
    totalPurchases = totalPurchases
)

fun SupplierDto.toDomain(): Supplier = Supplier(
    id = id,
    name = name,
    contactPerson = companyName.orEmpty(),
    email = email.orEmpty(),
    phone = phone.orEmpty(),
    address = address.orEmpty(),
    // El backend no almacena categorías de proveedor → nunca inventadas.
    categoriesSupplied = emptyList()
)

/* ------------------------------- Inventario ------------------------------- */

fun BalanceDto.toDomain(): InventoryItem {
    val qty = quantity
    val min = product?.stockMin ?: 0.0
    val status = when {
        qty <= 0 -> InventoryStatus.OUT_OF_STOCK
        qty <= min -> InventoryStatus.LOW
        else -> InventoryStatus.NORMAL
    }
    return InventoryItem(
        id = id ?: "",
        productId = productId?.id.orEmpty(),
        productName = product?.name.orEmpty(),
        sku = product?.sku.orEmpty(),
        quantityOnHand = qty.roundToInt(),
        reorderPoint = min.roundToInt(),
        location = warehouse?.name.orEmpty(),
        status = status
    )
}

fun MovementDto.toDomain(): InventoryMovement = InventoryMovement(
    id = id,
    productId = productId?.id.orEmpty(),
    productName = productId?.name.orEmpty(),
    type = movementTypeFromBackend(type),
    quantity = quantity.roundToInt(),
    date = parseServerDate(createdAt),
    reason = reason.orEmpty()
)

/* --------------------------- Ventas y Compras ----------------------------- */

private fun List<DocumentItemDto>.toSaleItems(): List<SaleItem> = map { item ->
    SaleItem(
        productId = item.productId,
        productName = item.name.orEmpty(),
        quantity = item.quantity.roundToInt(),
        unitPrice = item.unitPrice,
        subtotal = item.subtotal
    )
}

fun SaleDto.toDomain(): Sale = Sale(
    id = id,
    // Folio de pantalla derivado del _id real (el backend no emite folios).
    saleNumber = "V-" + id.takeLast(6).uppercase(),
    customerId = customerId?.id.orEmpty(),
    customerName = customerId?.name ?: "(Sin cliente)",
    items = items.toSaleItems(),
    totalAmount = total,
    date = parseServerDate(createdAt),
    status = documentStatusFromBackend(status)
)

fun PurchaseDto.toDomain(): Purchase = Purchase(
    id = id,
    purchaseNumber = "C-" + id.takeLast(6).uppercase(),
    supplierId = supplierId?.id.orEmpty(),
    supplierName = supplierId?.name ?: "(Sin proveedor)",
    items = items.map { item ->
        com.codeevo.erp.domain.model.PurchaseItem(
            productId = item.productId,
            productName = item.name.orEmpty(),
            quantity = item.quantity.roundToInt(),
            unitPrice = item.unitPrice,
            subtotal = item.subtotal
        )
    },
    totalAmount = total,
    date = parseServerDate(createdAt),
    status = documentStatusFromBackend(status)
)

/* -------------------------------- Dashboard ------------------------------- */

fun DashboardKpiDto.toDomain(): DashboardKpis = DashboardKpis(
    totalRevenue = salesMonth,
    // Sin histórico comparable en el backend → 0.0 (no se inventan tendencias).
    revenueGrowthPercent = 0.0,
    totalOrders = salesMonthCount,
    ordersGrowthPercent = 0.0,
    lowStockItemsCount = lowStockCount,
    activeCustomersCount = totalCustomers,
    totalExpenses = purchasesMonth,
    netProfit = salesMonth - purchasesMonth
)

fun LowStockDto.toDomain(): Product = Product(
    id = id.orEmpty(),
    sku = sku.orEmpty(),
    name = name.orEmpty(),
    description = "",
    category = "",
    price = 0.0,
    costPrice = 0.0,
    stockQuantity = totalStock.roundToInt(),
    minStockLevel = stockMin.roundToInt(),
    unit = unit.orEmpty()
)

fun TopProductDto.toDomain(maxUnits: Int): TopProduct = TopProduct(
    id = productId.orEmpty(),
    name = name.orEmpty(),
    category = sku.orEmpty(),
    unitsSold = quantity.roundToInt(),
    revenue = revenue,
    // Progreso relativo al producto más vendido (ratio real, sin metas ficticias).
    targetProgress = if (maxUnits > 0) (quantity / maxUnits).toFloat().coerceIn(0f, 1f) else 0f
)

/* -------------------------------- Auditoría -------------------------------- */

private fun formatPayload(value: Any?): String? = when (value) {
    null -> null
    is Map<*, *> -> value.entries.joinToString(
        prefix = "{\n",
        postfix = "\n}",
        separator = ",\n"
    ) { (k, v) -> "  \"$k\": $v" }
    is List<*> -> value.joinToString(prefix = "[\n", postfix = "\n]", separator = ",\n") { "  $it" }
    else -> value.toString()
}

fun AuditItemDto.toDomain(): AuditLog = AuditLog(
    id = id,
    userId = userId?.id.orEmpty(),
    userName = userId?.name ?: "sistema",
    action = action,
    targetModule = module.orEmpty(),
    timestamp = parseServerDate(createdAt),
    details = description.orEmpty(),
    payloadBefore = formatPayload(previousValue),
    payloadAfter = formatPayload(newValue)
)
