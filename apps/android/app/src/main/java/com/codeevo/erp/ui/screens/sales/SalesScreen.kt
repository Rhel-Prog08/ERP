package com.codeevo.erp.ui.screens.sales

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.ShoppingCart
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
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
import com.codeevo.erp.domain.model.DocumentStatus
import com.codeevo.erp.domain.model.Product
import com.codeevo.erp.domain.model.Sale
import com.codeevo.erp.domain.model.SaleItem
import com.codeevo.erp.domain.model.User
import com.codeevo.erp.ui.components.CodeEvoButton
import com.codeevo.erp.ui.components.CodeEvoCard
import com.codeevo.erp.ui.components.CodeEvoEmptyState
import com.codeevo.erp.ui.components.CodeEvoMoneyDisplay
import com.codeevo.erp.ui.components.CodeEvoSearchField
import com.codeevo.erp.ui.components.CodeEvoSecondaryButton
import com.codeevo.erp.ui.components.CodeEvoSkeletonList
import com.codeevo.erp.ui.components.CodeEvoStatusBadge
import com.codeevo.erp.ui.components.CodeEvoTextField
import com.codeevo.erp.ui.components.erp.CustomerSelectorDialog
import com.codeevo.erp.ui.components.erp.ProductSelectorDialog
import com.codeevo.erp.ui.components.erp.SaleSummary
import com.codeevo.erp.ui.theme.CodeEvoTheme
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun SalesScreen(
    user: User?,
    viewModel: SalesViewModel? = null
) {
    val context = LocalContext.current
    val actualViewModel: SalesViewModel = viewModel ?: run {
        val app = context.applicationContext as ERPApplication
        viewModel(
            factory = SalesViewModel.Factory(
                app.salesRepository,
                app.productRepository
            )
        )
    }

    val state by actualViewModel.uiState.collectAsState()

    var selectedSaleForDetail by remember { mutableStateOf<Sale?>(null) }
    var showCreateSaleFlow by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when (val uiState = state) {
            is SalesUiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Cargando Módulo de Ventas...",
                        style = MaterialTheme.typography.titleMedium,
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    CodeEvoSkeletonList(itemCount = 5)
                }
            }

            is SalesUiState.Error -> {
                CodeEvoEmptyState(
                    title = "Error en módulo de ventas",
                    description = uiState.message,
                    actionText = "Reintentar",
                    onActionClick = { actualViewModel.loadSalesData() }
                )
            }

            is SalesUiState.Content -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Header
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Rounded.ShoppingCart,
                                        contentDescription = null,
                                        tint = CodeEvoTheme.extraColors.primaryBlue
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Módulo de Ventas",
                                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                        color = CodeEvoTheme.extraColors.textPrimary
                                    )
                                }
                                Text(
                                    text = "Gestión de pedidos, comprobantes de venta y facturación",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = CodeEvoTheme.extraColors.textSecondary
                                )
                            }

                            CodeEvoButton(
                                text = "Nueva Venta",
                                onClick = { showCreateSaleFlow = true },
                                icon = Icons.Rounded.Add
                            )
                        }
                    }

                    // Search & Filters
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            CodeEvoSearchField(
                                value = uiState.searchQuery,
                                onValueChange = { actualViewModel.setSearchQuery(it) },
                                placeholder = "Buscar por folio de venta o cliente..."
                            )

                            // Status Filters
                            val statuses = listOf("Todas", "Borrador", "Confirmada", "Completada", "Cancelada")
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(statuses) { st ->
                                    FilterChip(
                                        selected = uiState.selectedStatus.equals(st, ignoreCase = true),
                                        onClick = { actualViewModel.setStatusFilter(st) },
                                        label = { Text(st, fontWeight = FontWeight.SemiBold) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = CodeEvoTheme.extraColors.primaryBlue,
                                            selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                                        )
                                    )
                                }
                            }
                        }
                    }

                    // List of Sales
                    if (uiState.filteredSales.isEmpty()) {
                        item {
                            CodeEvoEmptyState(
                                title = "No hay ventas registradas",
                                description = "No se encontraron facturas o pedidos para el filtro actual."
                            )
                        }
                    } else {
                        items(uiState.filteredSales, key = { it.id }) { sale ->
                            SaleCardItem(
                                sale = sale,
                                onClick = { selectedSaleForDetail = sale }
                            )
                        }
                    }
                }

                // Detail Dialog
                if (selectedSaleForDetail != null) {
                    SaleDetailDialog(
                        sale = selectedSaleForDetail!!,
                        onUpdateStatus = { newStatus ->
                            actualViewModel.updateSaleStatus(selectedSaleForDetail!!.id, newStatus)
                            selectedSaleForDetail = null
                        },
                        onDismissRequest = { selectedSaleForDetail = null }
                    )
                }

                // New Sale Creation Flow Dialog
                if (showCreateSaleFlow) {
                    CreateSaleFlowDialog(
                        customers = uiState.customers,
                        products = uiState.products,
                        onSaveSale = { newSale ->
                            actualViewModel.createSale(newSale)
                            showCreateSaleFlow = false
                        },
                        onDismissRequest = { showCreateSaleFlow = false }
                    )
                }
            }
        }
    }
}

@Composable
private fun SaleCardItem(
    sale: Sale,
    onClick: () -> Unit
) {
    val dateStr = remember(sale.date) {
        SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(Date(sale.date))
    }

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
                    Text(
                        text = sale.saleNumber,
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    CodeEvoStatusBadge(documentStatus = sale.status)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Cliente: ${sale.customerName} • Fecha: $dateStr",
                    style = MaterialTheme.typography.bodySmall,
                    color = CodeEvoTheme.extraColors.textSecondary
                )
                Text(
                    text = "${sale.items.size} artículos en el pedido",
                    style = MaterialTheme.typography.labelSmall,
                    color = CodeEvoTheme.extraColors.textSecondary
                )
            }

            CodeEvoMoneyDisplay(
                amount = sale.totalAmount,
                textStyle = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = CodeEvoTheme.extraColors.cyan
            )
        }
    }
}

@Composable
private fun SaleDetailDialog(
    sale: Sale,
    onUpdateStatus: (DocumentStatus) -> Unit,
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
                Text(
                    text = "Detalle de Venta ${sale.saleNumber}",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = CodeEvoTheme.extraColors.textPrimary
                )
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
                SaleSummary(sale = sale)
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (sale.status == DocumentStatus.DRAFT) {
                    CodeEvoButton(
                        text = "Confirmar Venta",
                        onClick = { onUpdateStatus(DocumentStatus.CONFIRMED) }
                    )
                } else if (sale.status == DocumentStatus.CONFIRMED) {
                    CodeEvoButton(
                        text = "Marcar Completada",
                        onClick = { onUpdateStatus(DocumentStatus.COMPLETED) }
                    )
                }
            }
        },
        dismissButton = {
            CodeEvoSecondaryButton(text = "Cerrar", onClick = onDismissRequest)
        }
    )
}

@Composable
private fun CreateSaleFlowDialog(
    customers: List<Customer>,
    products: List<Product>,
    onSaveSale: (Sale) -> Unit,
    onDismissRequest: () -> Unit
) {
    var selectedCustomer by remember { mutableStateOf<Customer?>(null) }
    var showCustomerSelector by remember { mutableStateOf(false) }

    var showProductSelector by remember { mutableStateOf(false) }
    val saleItems = remember { mutableStateListOf<SaleItem>() }

    var errorMsg by remember { mutableStateOf<String?>(null) }

    if (showCustomerSelector) {
        CustomerSelectorDialog(
            customers = customers,
            onCustomerSelected = { cust ->
                selectedCustomer = cust
                showCustomerSelector = false
            },
            onDismissRequest = { showCustomerSelector = false }
        )
    }

    if (showProductSelector) {
        ProductSelectorDialog(
            products = products,
            onProductSelected = { prod ->
                val existingIndex = saleItems.indexOfFirst { it.productId == prod.id }
                if (existingIndex != -1) {
                    val existing = saleItems[existingIndex]
                    val newQty = existing.quantity + 1
                    saleItems[existingIndex] = existing.copy(
                        quantity = newQty,
                        subtotal = newQty * existing.unitPrice
                    )
                } else {
                    saleItems.add(
                        SaleItem(
                            productId = prod.id,
                            productName = prod.name,
                            quantity = 1,
                            unitPrice = prod.price,
                            subtotal = prod.price
                        )
                    )
                }
                showProductSelector = false
            },
            onDismissRequest = { showProductSelector = false }
        )
    }

    val subtotal = saleItems.sumOf { it.subtotal }
    val totalAmount = subtotal * 1.16

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
                Text(
                    text = "Nueva Venta / Factura",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = CodeEvoTheme.extraColors.textPrimary
                )
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
                // Step 1: Customer Selection
                Column {
                    Text("1. Cliente", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textSecondary)
                    Spacer(modifier = Modifier.height(6.dp))
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showCustomerSelector = true },
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = CodeEvoTheme.extraColors.border.copy(alpha = 0.2f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = selectedCustomer?.name ?: "Seleccionar cliente de la lista...",
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontWeight = if (selectedCustomer != null) FontWeight.Bold else FontWeight.Normal
                                ),
                                color = if (selectedCustomer != null) CodeEvoTheme.extraColors.textPrimary else CodeEvoTheme.extraColors.textSecondary
                            )
                            Text("Cambiar", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.primaryBlue)
                        }
                    }
                }

                // Step 2: Item Selection
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("2. Artículos del Pedido", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textSecondary)
                        CodeEvoSecondaryButton(
                            text = "Agregar Producto",
                            onClick = { showProductSelector = true },
                            icon = Icons.Rounded.Add
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    if (saleItems.isEmpty()) {
                        Text(
                            text = "Aún no ha agregado productos a la venta.",
                            style = MaterialTheme.typography.bodySmall,
                            color = CodeEvoTheme.extraColors.textSecondary
                        )
                    } else {
                        saleItems.forEachIndexed { index, item ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = CodeEvoTheme.extraColors.border.copy(alpha = 0.2f))
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(item.productName, style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                                        Text("${item.quantity} x $${item.unitPrice}", style = MaterialTheme.typography.labelSmall, color = CodeEvoTheme.extraColors.textSecondary)
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        CodeEvoMoneyDisplay(amount = item.subtotal, color = CodeEvoTheme.extraColors.textPrimary)
                                        IconButton(onClick = { saleItems.removeAt(index) }) {
                                            Icon(Icons.Rounded.Delete, contentDescription = "Eliminar", tint = CodeEvoTheme.extraColors.danger)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                HorizontalDivider(color = CodeEvoTheme.extraColors.border.copy(alpha = 0.4f))

                // Totals Summary
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Total Estimado (Inc. IVA):", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                    CodeEvoMoneyDisplay(amount = totalAmount, textStyle = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.cyan)
                }

                if (errorMsg != null) {
                    Text(errorMsg!!, style = MaterialTheme.typography.bodySmall, color = CodeEvoTheme.extraColors.danger)
                }
            }
        },
        confirmButton = {
            CodeEvoButton(
                text = "Crear Venta",
                onClick = {
                    if (selectedCustomer == null) {
                        errorMsg = "Seleccione un cliente"
                    } else if (saleItems.isEmpty()) {
                        errorMsg = "Agregue al menos un producto"
                    } else {
                        val newSale = Sale(
                            id = "sale_${System.currentTimeMillis()}",
                            saleNumber = "INV-2025-${(100..999).random()}",
                            customerId = selectedCustomer!!.id,
                            customerName = selectedCustomer!!.name,
                            items = saleItems.toList(),
                            totalAmount = totalAmount,
                            date = System.currentTimeMillis(),
                            status = DocumentStatus.CONFIRMED
                        )
                        onSaveSale(newSale)
                    }
                }
            )
        },
        dismissButton = {
            CodeEvoSecondaryButton(text = "Cancelar", onClick = onDismissRequest)
        }
    )
}
