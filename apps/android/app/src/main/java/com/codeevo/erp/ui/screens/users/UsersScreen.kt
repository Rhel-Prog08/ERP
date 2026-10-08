package com.codeevo.erp.ui.screens.users

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Badge
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Security
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.codeevo.erp.ERPApplication
import com.codeevo.erp.data.repository.UserRepository
import com.codeevo.erp.domain.model.Permission
import com.codeevo.erp.domain.model.Role
import com.codeevo.erp.domain.model.User
import com.codeevo.erp.ui.components.CodeEvoBadge
import com.codeevo.erp.ui.components.CodeEvoButton
import com.codeevo.erp.ui.components.CodeEvoCard
import com.codeevo.erp.ui.components.CodeEvoEmptyState
import com.codeevo.erp.ui.components.CodeEvoSearchField
import com.codeevo.erp.ui.components.CodeEvoSecondaryButton
import com.codeevo.erp.ui.components.CodeEvoSkeletonList
import com.codeevo.erp.ui.components.CodeEvoTextField
import com.codeevo.erp.ui.theme.CodeEvoTheme

@Composable
fun UsersScreen(
    user: User?,
    viewModel: UsersViewModel? = null
) {
    val context = LocalContext.current
    val actualViewModel: UsersViewModel = viewModel ?: run {
        val app = context.applicationContext as ERPApplication
        viewModel(factory = UsersViewModel.Factory(app.userRepository))
    }

    val state by actualViewModel.uiState.collectAsState()

    var selectedUserForRbac by remember { mutableStateOf<User?>(null) }
    var showCreateUserDialog by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when (val uiState = state) {
            is UsersUiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(text = "Cargando Usuarios y Roles...", style = MaterialTheme.typography.titleMedium, color = CodeEvoTheme.extraColors.textPrimary)
                    CodeEvoSkeletonList(itemCount = 4)
                }
            }

            is UsersUiState.Error -> {
                CodeEvoEmptyState(
                    title = "Error al cargar usuarios",
                    description = uiState.message,
                    actionText = "Reintentar",
                    onActionClick = { actualViewModel.loadUsers() }
                )
            }

            is UsersUiState.Content -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Rounded.Badge, contentDescription = null, tint = CodeEvoTheme.extraColors.primaryBlue)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Usuarios y Roles (RBAC)", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                                }
                                Text("Administración de usuarios y matriz de permisos por módulo", style = MaterialTheme.typography.bodyMedium, color = CodeEvoTheme.extraColors.textSecondary)
                            }
                            CodeEvoButton(text = "Nuevo Usuario", onClick = { showCreateUserDialog = true }, icon = Icons.Rounded.Add)
                        }
                    }

                    item {
                        CodeEvoSearchField(
                            value = uiState.searchQuery,
                            onValueChange = { actualViewModel.setSearchQuery(it) },
                            placeholder = "Buscar usuario por nombre, email o rol..."
                        )
                    }

                    if (uiState.filteredUsers.isEmpty()) {
                        item {
                            CodeEvoEmptyState(title = "No se encontraron usuarios", description = "Pruebe con otros términos de búsqueda.")
                        }
                    } else {
                        items(uiState.filteredUsers, key = { it.id }) { u ->
                            UserCardItem(
                                userItem = u,
                                onClick = { selectedUserForRbac = u }
                            )
                        }
                    }
                }

                // RBAC Permission Matrix Dialog
                if (selectedUserForRbac != null) {
                    RbacPermissionMatrixDialog(
                        targetUser = selectedUserForRbac!!,
                        onTogglePermission = { perm ->
                            actualViewModel.togglePermission(selectedUserForRbac!!.id, perm)
                            // Update local reference to reflect immediate toggle
                            val currentPerms = selectedUserForRbac!!.permissions
                            val updatedPerms = if (currentPerms.contains(perm)) currentPerms - perm else currentPerms + perm
                            selectedUserForRbac = selectedUserForRbac!!.copy(permissions = updatedPerms)
                        },
                        onDismissRequest = { selectedUserForRbac = null }
                    )
                }

                // Create User Dialog
                if (showCreateUserDialog) {
                    CreateUserDialog(
                        onSaveUser = { newUser ->
                            actualViewModel.addUser(newUser)
                            showCreateUserDialog = false
                        },
                        onDismissRequest = { showCreateUserDialog = false }
                    )
                }
            }
        }
    }
}

@Composable
private fun UserCardItem(
    userItem: User,
    onClick: () -> Unit
) {
    CodeEvoCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        contentPadding = 16.dp
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(CodeEvoTheme.extraColors.primaryBlue),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = userItem.name.take(2).uppercase(),
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = Color.White
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(userItem.name, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                        Spacer(modifier = Modifier.width(8.dp))
                        CodeEvoBadge(text = userItem.roleName.ifBlank { userItem.role.name })
                    }
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(userItem.email, style = MaterialTheme.typography.bodySmall, color = CodeEvoTheme.extraColors.textSecondary)
                }
            }

            CodeEvoSecondaryButton(
                text = "Permisos (${userItem.permissions.size})",
                onClick = onClick,
                icon = Icons.Rounded.Security
            )
        }
    }
}

@Composable
private fun RbacPermissionMatrixDialog(
    targetUser: User,
    onTogglePermission: (Permission) -> Unit,
    onDismissRequest: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismissRequest,
        modifier = Modifier.fillMaxWidth(0.95f),
        containerColor = CodeEvoTheme.extraColors.surface2,
        shape = RoundedCornerShape(20.dp),
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Matriz de Permisos RBAC",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    Text(
                        text = "Usuario: ${targetUser.name} (${targetUser.roleName.ifBlank { targetUser.role.name }})",
                        style = MaterialTheme.typography.bodySmall,
                        color = CodeEvoTheme.extraColors.textSecondary
                    )
                }
                IconButton(onClick = onDismissRequest) {
                    Icon(Icons.Rounded.Close, contentDescription = "Cerrar", tint = CodeEvoTheme.extraColors.textSecondary)
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (targetUser.role == Role.ADMIN) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = CodeEvoTheme.extraColors.primaryBlue.copy(alpha = 0.15f))
                    ) {
                        Text(
                            text = "El rol ADMIN posee acceso total irrestricto a todos los módulos del ERP.",
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                            color = CodeEvoTheme.extraColors.primaryBlue,
                            modifier = Modifier.padding(14.dp)
                        )
                    }
                }

                PermissionGroupSection(
                    groupTitle = "Catálogo de Productos",
                    permissions = listOf(
                        Permission.READ_PRODUCTS to "Ver productos y precios",
                        Permission.WRITE_PRODUCTS to "Crear y editar productos"
                    ),
                    userPermissions = targetUser.permissions,
                    onToggle = onTogglePermission
                )

                PermissionGroupSection(
                    groupTitle = "Módulo de Ventas",
                    permissions = listOf(
                        Permission.READ_SALES to "Ver ventas y cotizaciones",
                        Permission.WRITE_SALES to "Generar y gestionar ventas"
                    ),
                    userPermissions = targetUser.permissions,
                    onToggle = onTogglePermission
                )

                PermissionGroupSection(
                    groupTitle = "Módulo de Compras",
                    permissions = listOf(
                        Permission.READ_PURCHASES to "Ver órdenes de compra",
                        Permission.WRITE_PURCHASES to "Generar órdenes de compra"
                    ),
                    userPermissions = targetUser.permissions,
                    onToggle = onTogglePermission
                )

                PermissionGroupSection(
                    groupTitle = "Control de Inventario",
                    permissions = listOf(
                        Permission.MANAGE_INVENTORY to "Ajustes y entradas/salidas de inventario"
                    ),
                    userPermissions = targetUser.permissions,
                    onToggle = onTogglePermission
                )

                PermissionGroupSection(
                    groupTitle = "Administración y Finanzas",
                    permissions = listOf(
                        Permission.VIEW_FINANCES to "Ver reportes y estados financieros",
                        Permission.MANAGE_USERS to "Gestionar usuarios, roles y auditoría"
                    ),
                    userPermissions = targetUser.permissions,
                    onToggle = onTogglePermission
                )
            }
        },
        confirmButton = {
            CodeEvoButton(text = "Listo", onClick = onDismissRequest)
        }
    )
}

@Composable
private fun PermissionGroupSection(
    groupTitle: String,
    permissions: List<Pair<Permission, String>>,
    userPermissions: List<Permission>,
    onToggle: (Permission) -> Unit
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = CodeEvoTheme.extraColors.border.copy(alpha = 0.2f))
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(groupTitle, style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
            HorizontalDivider(color = CodeEvoTheme.extraColors.border.copy(alpha = 0.3f))

            permissions.forEach { (perm, description) ->
                val isChecked = userPermissions.contains(perm)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(perm.name, style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                        Text(description, style = MaterialTheme.typography.bodySmall, color = CodeEvoTheme.extraColors.textSecondary)
                    }

                    Switch(
                        checked = isChecked,
                        onCheckedChange = { onToggle(perm) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = CodeEvoTheme.extraColors.primaryBlue
                        )
                    )
                }
            }
        }
    }
}

@Composable
private fun CreateUserDialog(
    onSaveUser: (UserRepository.CreateUserInput) -> Unit,
    onDismissRequest: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    // El backend exige password de 8+ caracteres en POST /users.
    var password by remember { mutableStateOf("") }
    var selectedRole by remember { mutableStateOf(Role.SALES) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismissRequest,
        containerColor = CodeEvoTheme.extraColors.surface2,
        shape = RoundedCornerShape(20.dp),
        title = {
            Text("Nuevo Usuario", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                CodeEvoTextField(value = name, onValueChange = { name = it }, label = "Nombre Completo", placeholder = "Juan Pérez")
                CodeEvoTextField(value = email, onValueChange = { email = it }, label = "Correo Electrónico", placeholder = "j.perez@codeevo.com")
                CodeEvoTextField(value = password, onValueChange = { password = it }, label = "Contraseña (mín. 8 caracteres)", placeholder = "••••••••")

                Text("Rol de Usuario", style = MaterialTheme.typography.labelMedium, color = CodeEvoTheme.extraColors.textSecondary)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Role.entries.forEach { r ->
                        CodeEvoBadge(
                            text = r.name,
                            backgroundColor = if (selectedRole == r) CodeEvoTheme.extraColors.primaryBlue else CodeEvoTheme.extraColors.border.copy(alpha = 0.3f),
                            contentColor = if (selectedRole == r) Color.White else CodeEvoTheme.extraColors.textPrimary,
                            modifier = Modifier.clickable { selectedRole = r }
                        )
                    }
                }

                if (errorMsg != null) {
                    Text(errorMsg!!, color = CodeEvoTheme.extraColors.danger, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            CodeEvoButton(
                text = "Crear Usuario",
                onClick = {
                    when {
                        name.isBlank() || email.isBlank() -> {
                            errorMsg = "Por favor llene todos los campos"
                        }
                        password.length < 8 -> {
                            errorMsg = "La contraseña debe tener al menos 8 caracteres"
                        }
                        else -> {
                            errorMsg = null
                            onSaveUser(
                                UserRepository.CreateUserInput(
                                    fullName = name.trim(),
                                    email = email.trim(),
                                    password = password,
                                    role = selectedRole
                                )
                            )
                        }
                    }
                }
            )
        },
        dismissButton = {
            CodeEvoSecondaryButton(text = "Cancelar", onClick = onDismissRequest)
        }
    )
}
