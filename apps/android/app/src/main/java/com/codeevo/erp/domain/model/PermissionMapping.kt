package com.codeevo.erp.domain.model

/**
 * Mapeo 1:1 entre los enums de la UI y los valores REALES del backend
 * (apps/backend/src/config/constants.js). Ningún nombre es inventado:
 *
 *  - Roles sembrados: Administrador, Gerente, Ventas, Compras, Almacén, Consulta
 *  - Permisos: claves <módulo>.<acción> (56 en el catálogo)
 *  - Estados de documento: DRAFT/CONFIRMED/COMPLETED|RECEIVED/CANCELLED
 *  - Movimientos: ENTRY/EXIT/ADJUSTMENT/RETURN
 */

/* --------------------------------- Roles --------------------------------- */

/** Nombre real del rol en la BD para el selector de la UI. */
fun Role.toBackendName(): String = when (this) {
    Role.ADMIN -> "Administrador"
    Role.MANAGER -> "Gerente"
    Role.SALES -> "Ventas"
    Role.INVENTORY -> "Almacén"
    Role.FINANCE -> "Compras"
}

/** Nombre de rol del backend → enum de UI (roles sin equivalente ⇒ MANAGER). */
fun roleFromBackendName(name: String?): Role = when (name?.trim()?.lowercase()) {
    "administrador" -> Role.ADMIN
    "gerente" -> Role.MANAGER
    "ventas" -> Role.SALES
    "almacén", "almacen" -> Role.INVENTORY
    "compras" -> Role.FINANCE
    "consulta" -> Role.MANAGER
    else -> Role.MANAGER
}

/* -------------------------------- Permisos -------------------------------- */

/**
 * Claves reales del catálogo que representan cada permiso de la UI.
 * El toggle de la matriz RBAC activa/desactiva el conjunto completo de
 * claves del grupo (semántica "cualquiera de ellas" al leer).
 */
val Permission.backendKeys: List<String>
    get() = when (this) {
        Permission.READ_PRODUCTS -> listOf("products.read")
        Permission.WRITE_PRODUCTS -> listOf("products.create", "products.update", "products.delete")
        Permission.READ_SALES -> listOf("sales.read")
        Permission.WRITE_SALES -> listOf("sales.create", "sales.update", "sales.cancel")
        Permission.READ_PURCHASES -> listOf("purchases.read")
        Permission.WRITE_PURCHASES -> listOf("purchases.create", "purchases.update", "purchases.cancel")
        // MANAGE_USERS agrupa gestión de usuarios + vistas de roles/auditoría.
        Permission.MANAGE_USERS -> listOf(
            "users.read", "users.create", "users.update", "users.delete",
            "roles.read", "roles.create", "roles.update", "roles.delete",
            "permissions.read", "audit.read"
        )
        Permission.VIEW_FINANCES -> listOf("dashboard.read", "reports.read", "reports.export")
        Permission.MANAGE_INVENTORY -> listOf("inventory.entry", "inventory.exit", "inventory.adjust")
    }

private val allMappedKeys: Set<String> = Permission.entries.flatMap { it.backendKeys }.toSet()

/** Claves reales del rol → permisos de UI (un permiso si tiene AL MENOS una clave). */
fun permissionsFromKeys(keys: List<String>): List<Permission> =
    Permission.entries.filter { perm -> perm.backendKeys.any { it in keys } }

/**
 * Aplica los toggles de la matriz RBAC sobre las claves crudas del rol:
 * conserva las claves reales sin equivalente en el enum (customers.read, …)
 * y añade/quita sólo las claves de los permisos afectados.
 */
fun applyPermissionToggles(rawKeys: List<String>, enabled: List<Permission>): List<String> {
    val unmapped = rawKeys.filter { it !in allMappedKeys }
    val mappedEnabled = enabled.flatMap { it.backendKeys }
    return (unmapped + mappedEnabled).distinct()
}

/* --------------------------- Estados de documento ------------------------ */

/** Enum de UI → estado del backend. COMPLETED de compras ⇒ RECEIVED. */
fun DocumentStatus.toBackend(purchases: Boolean = false): String = when (this) {
    DocumentStatus.DRAFT -> "DRAFT"
    DocumentStatus.CONFIRMED -> "CONFIRMED"
    DocumentStatus.COMPLETED -> if (purchases) "RECEIVED" else "COMPLETED"
    DocumentStatus.CANCELLED -> "CANCELLED"
}

/** Estado del backend → enum de UI (RECEIVED de compras ⇒ COMPLETED). */
fun documentStatusFromBackend(status: String?): DocumentStatus = when (status) {
    "DRAFT" -> DocumentStatus.DRAFT
    "CONFIRMED" -> DocumentStatus.CONFIRMED
    "COMPLETED", "RECEIVED" -> DocumentStatus.COMPLETED
    "CANCELLED" -> DocumentStatus.CANCELLED
    else -> DocumentStatus.DRAFT
}

/* ------------------------ Movimientos de inventario ---------------------- */

/** Tipo del formulario de la UI → tipo del backend. */
fun movementTypeToBackend(uiType: String): String = when (uiType.uppercase()
    .replace("Ó", "O")) {
    "ENTRADA" -> "ENTRY"
    "SALIDA" -> "EXIT"
    "AJUSTE" -> "ADJUSTMENT"
    "DEVOLUCION" -> "RETURN"
    else -> "ENTRY"
}

/** Tipo del backend → etiqueta de la UI. */
fun movementTypeFromBackend(type: String?): String = when (type) {
    "ENTRY" -> "ENTRADA"
    "EXIT" -> "SALIDA"
    "ADJUSTMENT" -> "AJUSTE"
    "RETURN" -> "DEVOLUCIÓN"
    else -> type ?: ""
}
