package com.codeevo.erp.ui.screens.suppliers

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.LocalShipping
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.codeevo.erp.ERPApplication
import com.codeevo.erp.domain.model.Supplier
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
fun SuppliersScreen(
    user: User?,
    viewModel: SuppliersViewModel? = null
) {
    val context = LocalContext.current
    val actualViewModel: SuppliersViewModel = viewModel ?: run {
        val app = context.applicationContext as ERPApplication
        viewModel(factory = SuppliersViewModel.Factory(app.salesRepository))
    }

    val state by actualViewModel.uiState.collectAsState()

    var showCreateDialog by remember { mutableStateOf(false) }
    var selectedSupplierForEdit by remember { mutableStateOf<Supplier?>(null) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when (val uiState = state) {
            is SuppliersUiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(text = "Cargando Proveedores...", style = MaterialTheme.typography.titleMedium, color = CodeEvoTheme.extraColors.textPrimary)
                    CodeEvoSkeletonList(itemCount = 4)
                }
            }

            is SuppliersUiState.Error -> {
                CodeEvoEmptyState(
                    title = "Error al cargar proveedores",
                    description = uiState.message,
                    actionText = "Reintentar",
                    onActionClick = { actualViewModel.loadSuppliers() }
                )
            }

            is SuppliersUiState.Content -> {
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
                                    Icon(Icons.Rounded.LocalShipping, contentDescription = null, tint = CodeEvoTheme.extraColors.primaryBlue)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Registro de Proveedores", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                                }
                                Text("Directorio de distribuidores, líneas suministradas y contactos", style = MaterialTheme.typography.bodyMedium, color = CodeEvoTheme.extraColors.textSecondary)
                            }
                            CodeEvoButton(text = "Nuevo Proveedor", onClick = { showCreateDialog = true }, icon = Icons.Rounded.Add)
                        }
                    }

                    item {
                        CodeEvoSearchField(
                            value = uiState.searchQuery,
                            onValueChange = { actualViewModel.setSearchQuery(it) },
                            placeholder = "Buscar proveedor por nombre o contacto..."
                        )
                    }

                    if (uiState.filteredSuppliers.isEmpty()) {
                        item {
                            CodeEvoEmptyState(title = "No se encontraron proveedores", description = "Pruebe con otros términos de búsqueda.")
                        }
                    } else {
                        items(uiState.filteredSuppliers, key = { it.id }) { supplier ->
                            SupplierCardItem(supplier = supplier, onClick = { selectedSupplierForEdit = supplier })
                        }
                    }
                }

                if (showCreateDialog || selectedSupplierForEdit != null) {
                    SupplierFormDialog(
                        initialSupplier = selectedSupplierForEdit,
                        onSave = { supp ->
                            if (selectedSupplierForEdit != null) {
                                actualViewModel.updateSupplier(supp)
                            } else {
                                actualViewModel.addSupplier(supp)
                            }
                            showCreateDialog = false
                            selectedSupplierForEdit = null
                        },
                        onDismissRequest = {
                            showCreateDialog = false
                            selectedSupplierForEdit = null
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun SupplierCardItem(supplier: Supplier, onClick: () -> Unit) {
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
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(supplier.name, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    if (supplier.categoriesSupplied.isNotEmpty()) {
                        CodeEvoBadge(text = supplier.categoriesSupplied.first())
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text("Contacto: ${supplier.contactPerson} • Email: ${supplier.email}", style = MaterialTheme.typography.bodySmall, color = CodeEvoTheme.extraColors.textSecondary)
                Text("Teléfono: ${supplier.phone} • Dirección: ${supplier.address}", style = MaterialTheme.typography.labelSmall, color = CodeEvoTheme.extraColors.textSecondary)
            }
        }
    }
}

@Composable
private fun SupplierFormDialog(
    initialSupplier: Supplier?,
    onSave: (Supplier) -> Unit,
    onDismissRequest: () -> Unit
) {
    var name by remember { mutableStateOf(initialSupplier?.name ?: "") }
    var contactPerson by remember { mutableStateOf(initialSupplier?.contactPerson ?: "") }
    var email by remember { mutableStateOf(initialSupplier?.email ?: "") }
    var phone by remember { mutableStateOf(initialSupplier?.phone ?: "") }
    var address by remember { mutableStateOf(initialSupplier?.address ?: "") }
    var categoryText by remember { mutableStateOf(initialSupplier?.categoriesSupplied?.joinToString(", ") ?: "Hardware") }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismissRequest,
        containerColor = CodeEvoTheme.extraColors.surface2,
        shape = RoundedCornerShape(20.dp),
        title = {
            Text(
                text = if (initialSupplier == null) "Nuevo Proveedor" else "Editar Proveedor",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = CodeEvoTheme.extraColors.textPrimary
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                CodeEvoTextField(value = name, onValueChange = { name = it }, label = "Razón Social / Proveedor", placeholder = "Cisco Wholesale")
                CodeEvoTextField(value = contactPerson, onValueChange = { contactPerson = it }, label = "Persona de Contacto", placeholder = "Carlos Mendoza")
                CodeEvoTextField(value = email, onValueChange = { email = it }, label = "Correo Electrónico", placeholder = "ventas@cisco.com")
                CodeEvoTextField(value = phone, onValueChange = { phone = it }, label = "Teléfono de Atención", placeholder = "+1 800-123-4567")
                CodeEvoTextField(value = address, onValueChange = { address = it }, label = "Dirección Matriz", placeholder = "100 Tech Blvd", singleLine = false)
                CodeEvoTextField(value = categoryText, onValueChange = { categoryText = it }, label = "Categorías Suministradas", placeholder = "Hardware, Redes, Software")

                if (errorMsg != null) {
                    Text(errorMsg!!, color = CodeEvoTheme.extraColors.danger, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            CodeEvoButton(
                text = "Guardar Proveedor",
                onClick = {
                    if (name.isBlank() || email.isBlank()) {
                        errorMsg = "Nombre y correo son obligatorios"
                    } else {
                        val cats = categoryText.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                        val supp = Supplier(
                            id = initialSupplier?.id ?: "supp_${System.currentTimeMillis()}",
                            name = name,
                            contactPerson = contactPerson,
                            email = email,
                            phone = phone,
                            address = address,
                            categoriesSupplied = cats
                        )
                        onSave(supp)
                    }
                }
            )
        },
        dismissButton = {
            CodeEvoSecondaryButton(text = "Cancelar", onClick = onDismissRequest)
        }
    )
}
