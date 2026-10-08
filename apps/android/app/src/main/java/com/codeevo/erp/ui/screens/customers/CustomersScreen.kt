package com.codeevo.erp.ui.screens.customers

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
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.People
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.codeevo.erp.domain.model.Customer
import com.codeevo.erp.domain.model.User
import com.codeevo.erp.ui.components.CodeEvoBadge
import com.codeevo.erp.ui.components.CodeEvoButton
import com.codeevo.erp.ui.components.CodeEvoCard
import com.codeevo.erp.ui.components.CodeEvoEmptyState
import com.codeevo.erp.ui.components.CodeEvoMoneyDisplay
import com.codeevo.erp.ui.components.CodeEvoSearchField
import com.codeevo.erp.ui.components.CodeEvoSecondaryButton
import com.codeevo.erp.ui.components.CodeEvoSkeletonList
import com.codeevo.erp.ui.components.CodeEvoTextField
import com.codeevo.erp.ui.theme.CodeEvoTheme

@Composable
fun CustomersScreen(
    user: User?,
    viewModel: CustomersViewModel? = null
) {
    val context = LocalContext.current
    val actualViewModel: CustomersViewModel = viewModel ?: run {
        val app = context.applicationContext as ERPApplication
        viewModel(factory = CustomersViewModel.Factory(app.salesRepository))
    }

    val state by actualViewModel.uiState.collectAsState()

    var showCreateDialog by remember { mutableStateOf(false) }
    var selectedCustomerForEdit by remember { mutableStateOf<Customer?>(null) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when (val uiState = state) {
            is CustomersUiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(text = "Cargando Clientes...", style = MaterialTheme.typography.titleMedium, color = CodeEvoTheme.extraColors.textPrimary)
                    CodeEvoSkeletonList(itemCount = 4)
                }
            }

            is CustomersUiState.Error -> {
                CodeEvoEmptyState(
                    title = "Error al cargar clientes",
                    description = uiState.message,
                    actionText = "Reintentar",
                    onActionClick = { actualViewModel.loadCustomers() }
                )
            }

            is CustomersUiState.Content -> {
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
                                    Icon(Icons.Rounded.People, contentDescription = null, tint = CodeEvoTheme.extraColors.primaryBlue)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Directorio de Clientes", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                                }
                                Text("Cartera comercial de clientes, compras acumuladas y contacto", style = MaterialTheme.typography.bodyMedium, color = CodeEvoTheme.extraColors.textSecondary)
                            }
                            CodeEvoButton(text = "Nuevo Cliente", onClick = { showCreateDialog = true }, icon = Icons.Rounded.Add)
                        }
                    }

                    item {
                        CodeEvoSearchField(
                            value = uiState.searchQuery,
                            onValueChange = { actualViewModel.setSearchQuery(it) },
                            placeholder = "Buscar cliente por nombre, empresa o correo..."
                        )
                    }

                    if (uiState.filteredCustomers.isEmpty()) {
                        item {
                            CodeEvoEmptyState(title = "No se encontraron clientes", description = "Pruebe con otros términos de búsqueda.")
                        }
                    } else {
                        items(uiState.filteredCustomers, key = { it.id }) { customer ->
                            CustomerCardItem(customer = customer, onClick = { selectedCustomerForEdit = customer })
                        }
                    }
                }

                if (showCreateDialog || selectedCustomerForEdit != null) {
                    CustomerFormDialog(
                        initialCustomer = selectedCustomerForEdit,
                        onSave = { cust ->
                            if (selectedCustomerForEdit != null) {
                                actualViewModel.updateCustomer(cust)
                            } else {
                                actualViewModel.addCustomer(cust)
                            }
                            showCreateDialog = false
                            selectedCustomerForEdit = null
                        },
                        onDismissRequest = {
                            showCreateDialog = false
                            selectedCustomerForEdit = null
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun CustomerCardItem(customer: Customer, onClick: () -> Unit) {
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
                    Text(customer.name, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    CodeEvoBadge(text = customer.company)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text("Email: ${customer.email} • Tel: ${customer.phone}", style = MaterialTheme.typography.bodySmall, color = CodeEvoTheme.extraColors.textSecondary)
                Text("Dirección: ${customer.address}", style = MaterialTheme.typography.labelSmall, color = CodeEvoTheme.extraColors.textSecondary)
            }

            Column(horizontalAlignment = Alignment.End) {
                Text("Compras Acumuladas", style = MaterialTheme.typography.labelSmall, color = CodeEvoTheme.extraColors.textSecondary)
                CodeEvoMoneyDisplay(amount = customer.totalPurchases, textStyle = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.primaryBlue)
            }
        }
    }
}

@Composable
private fun CustomerFormDialog(
    initialCustomer: Customer?,
    onSave: (Customer) -> Unit,
    onDismissRequest: () -> Unit
) {
    var name by remember { mutableStateOf(initialCustomer?.name ?: "") }
    var email by remember { mutableStateOf(initialCustomer?.email ?: "") }
    var phone by remember { mutableStateOf(initialCustomer?.phone ?: "") }
    var company by remember { mutableStateOf(initialCustomer?.company ?: "") }
    var address by remember { mutableStateOf(initialCustomer?.address ?: "") }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismissRequest,
        containerColor = CodeEvoTheme.extraColors.surface2,
        shape = RoundedCornerShape(20.dp),
        title = {
            Text(
                text = if (initialCustomer == null) "Nuevo Cliente" else "Editar Cliente",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = CodeEvoTheme.extraColors.textPrimary
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                CodeEvoTextField(value = name, onValueChange = { name = it }, label = "Nombre Completo / Razón Social", placeholder = "Acme Corp")
                CodeEvoTextField(value = company, onValueChange = { company = it }, label = "Empresa", placeholder = "Acme Solutions")
                CodeEvoTextField(value = email, onValueChange = { email = it }, label = "Correo Electrónico", placeholder = "contacto@acme.com")
                CodeEvoTextField(value = phone, onValueChange = { phone = it }, label = "Teléfono de Contacto", placeholder = "+51 987654321")
                CodeEvoTextField(value = address, onValueChange = { address = it }, label = "Dirección Fiscal / Entrega", placeholder = "Av. Principal 123", singleLine = false)

                if (errorMsg != null) {
                    Text(errorMsg!!, color = CodeEvoTheme.extraColors.danger, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            CodeEvoButton(
                text = "Guardar Cliente",
                onClick = {
                    if (name.isBlank() || email.isBlank()) {
                        errorMsg = "Nombre y correo son obligatorios"
                    } else {
                        val cust = Customer(
                            id = initialCustomer?.id ?: "cust_${System.currentTimeMillis()}",
                            name = name,
                            email = email,
                            phone = phone,
                            company = company,
                            address = address,
                            totalPurchases = initialCustomer?.totalPurchases ?: 0.0
                        )
                        onSave(cust)
                    }
                }
            )
        },
        dismissButton = {
            CodeEvoSecondaryButton(text = "Cancelar", onClick = onDismissRequest)
        }
    )
}
