package com.codeevo.erp.domain.model

/**
 * Usuario de dominio. El backend devuelve:
 *   auth:  { id, firstName, lastName, email, status, company{id,name},
 *            role{id,name,permissions[]} }
 *   users: { _id, firstName, lastName, email, status, roleId{_id,name} }
 *
 * Se normaliza a un único modelo con `firstName`/`lastName` (con `name`
 * calculado para la UI), el rol como [Role] + `roleName` crudo del backend y
 * los permisos como subconjunto de [Permission] mapeado desde las claves
 * reales (`products.read`, `sales.create`, …) — ver [PermissionMapping].
 *
 * `rawPermissions` conserva TODAS las claves del rol (incluidas las que no
 * tienen equivalente en el enum) para poder guardarlas de vuelta sin perder
 * datos al editar permisos.
 */
data class User(
    val id: String,
    val firstName: String = "",
    val lastName: String = "",
    val email: String = "",
    val status: String = "active",
    val companyName: String = "",
    val roleId: String = "",
    val roleName: String = "",
    val role: Role,
    val permissions: List<Permission> = emptyList(),
    val rawPermissions: List<String> = emptyList()
) {
    /** Nombre completo para la UI (sesión guardada antigua incluida). */
    val name: String
        get() = listOf(firstName, lastName)
            .filter { it.isNotBlank() }
            .joinToString(" ")
            .ifBlank { email }
}

/**
 * Control de acceso del cliente. En el backend la autorización final es
 * SIEMPRE server-side (RBAC); aquí sólo gobierna la visibilidad de menús y
 * botones. ADMIN ⇒ todo; el resto requiere la clave real correspondiente.
 */
fun User.hasPermission(permission: Permission?): Boolean {
    if (permission == null) return true
    if (this.role == Role.ADMIN) return true
    return this.permissions.contains(permission)
}
