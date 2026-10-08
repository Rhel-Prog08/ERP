package com.codeevo.erp.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.FactCheck
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.Badge
import androidx.compose.material.icons.rounded.BarChart
import androidx.compose.material.icons.rounded.Category
import androidx.compose.material.icons.rounded.Dashboard
import androidx.compose.material.icons.rounded.Inventory2
import androidx.compose.material.icons.rounded.LocalShipping
import androidx.compose.material.icons.rounded.People
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.ShoppingCart
import androidx.compose.ui.graphics.vector.ImageVector
import com.codeevo.erp.domain.model.Permission
import com.codeevo.erp.domain.model.User
import com.codeevo.erp.domain.model.hasPermission

data class NavItem(
    val title: String,
    val route: Any,
    val icon: ImageVector,
    val requiredPermission: Permission? = null
)

data class NavGroup(
    val title: String,
    val items: List<NavItem>
)

fun getNavGroupsForUser(user: User?): List<NavGroup> {
    if (user == null) return emptyList()

    val allGroups = listOf(
        NavGroup(
            title = "PRINCIPAL",
            items = listOf(
                NavItem("Dashboard", DashboardRoute, Icons.Rounded.Dashboard, null)
            )
        ),
        NavGroup(
            title = "OPERACIONES",
            items = listOf(
                NavItem("Ventas", SalesRoute, Icons.Rounded.ShoppingCart, Permission.READ_SALES),
                NavItem("Compras", PurchasesRoute, Icons.AutoMirrored.Rounded.ReceiptLong, Permission.READ_PURCHASES),
                NavItem("Inventario", InventoryRoute, Icons.Rounded.Inventory2, Permission.MANAGE_INVENTORY)
            )
        ),
        NavGroup(
            title = "CATÁLOGOS",
            items = listOf(
                NavItem("Productos", ProductsRoute, Icons.Rounded.Category, Permission.READ_PRODUCTS),
                NavItem("Clientes", CustomersRoute, Icons.Rounded.People, Permission.READ_SALES),
                NavItem("Proveedores", SuppliersRoute, Icons.Rounded.LocalShipping, Permission.READ_PURCHASES)
            )
        ),
        NavGroup(
            title = "ORGANIZACIÓN",
            items = listOf(
                NavItem("Usuarios y Roles", UsersRoute, Icons.Rounded.Badge, Permission.MANAGE_USERS)
            )
        ),
        NavGroup(
            title = "ANÁLISIS",
            items = listOf(
                NavItem("Reportes", ReportsRoute, Icons.Rounded.BarChart, Permission.VIEW_FINANCES),
                NavItem("Auditoría", AuditRoute, Icons.AutoMirrored.Rounded.FactCheck, Permission.MANAGE_USERS)
            )
        ),
        NavGroup(
            title = "CONFIGURACIÓN",
            items = listOf(
                NavItem("Empresa y Configuración", SettingsRoute, Icons.Rounded.Settings, null)
            )
        )
    )

    return allGroups.mapNotNull { group ->
        val visibleItems = group.items.filter { item ->
            user.hasPermission(item.requiredPermission)
        }
        if (visibleItems.isNotEmpty()) {
            group.copy(items = visibleItems)
        } else {
            null
        }
    }
}
