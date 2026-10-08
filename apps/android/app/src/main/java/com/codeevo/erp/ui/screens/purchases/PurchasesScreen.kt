package com.codeevo.erp.ui.screens.purchases

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
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.MoveToInbox
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
import com.codeevo.erp.domain.model.DocumentStatus
import com.codeevo.erp.domain.model.Product
import com.codeevo.erp.domain.model.Purchase
import com.codeevo.erp.domain.model.PurchaseItem
import com.codeevo.erp.domain.model.Supplier
import com.codeevo.erp.domain.model.User
import com.codeevo.erp.ui.components.CodeEvoButton
import com.codeevo.erp.ui.components.CodeEvoCard
import com.codeevo.erp.ui.components.CodeEvoConfirmDialog
import com.codeevo.erp.ui.components.CodeEvoEmptyState
import com.codeevo.erp.ui.components.CodeEvoMoneyDisplay
import com.codeevo.erp.ui.components.CodeEvoSearchField
import com.codeevo.erp.ui.components.CodeEvoSecondaryButton
import com.codeevo.erp.ui.components.CodeEvoSkeletonList
import com.codeevo.erp.ui.components.CodeEvoStatusBadge
import com.codeevo.erp.ui.components.erp.ProductSelectorDialog
import com.codeevo.erp.ui.components.erp.PurchaseSummary
import com.codeevo.erp.ui.components.erp.SupplierSelectorDialog
import com.codeevo.erp.ui.theme.CodeEvoTheme
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun PurchasesScreen(
    user: User?,
    viewModel: PurchasesViewModel? = null
) {
    val context = LocalContext.current
    val actualViewModel: PurchasesViewModel = viewModel ?: run {
        val app = context.applicationContext as ERPApplication
        viewModel(
            factory = PurchasesViewModel.Factory(
                app.salesRepository,
                app.productRepository
            )
        )
    }

    val state by actualViewModel.uiState.collectAsState()

    var selectedPurchaseForDetail by remember { mutableStateOf<Purchase?>(null) }
    var showCreatePurchaseFlow by remember { mutableStateOf(false) }
    var purchaseToReceive by remember { mutableStateOf<Purchase?>(null) }

    if (purchaseToReceive != null) {
        CodeEvoConfirmDialog(
            title = "Recibir Inventario de Orden de Compra",
            message = "¿Desea dar entrada al almacén de todos los artículos incluidos en la orden #${purchaseToReceive?.purchaseNumber}?",
            confirmText = "Recibir e Ingresar Stock",
            dismissText = "Cancelar",
            onConfirm = {
                actualViewModel.receiveInventory(purchaseToReceive!!)
                purchaseToReceive = null
                selectedPurchaseForDetail = null
            },
            onDismiss = { purchaseToReceive = null }
        )
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when (val uiState = state) {
            is PurchasesUiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Cargando Módulo de Compras...",
                        style = MaterialTheme.typography.titleMedium,
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    CodeEvoSkeletonList(itemCount = 5)
                }
            }

            is PurchasesUiState.Error -> {
                CodeEvoEmptyState(
                    title = "Error en módulo de compras",
                    description = uiState.message,
                    actionText = "Reintentar",
                    onActionClick = { actualViewModel.loadPurchasesData() }
                )
            }

            is PurchasesUiState.Content -> {
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
                                        imageVector = Icons.AutoMirrored.Rounded.ReceiptLong,
                                        contentDescription = null,
                                        tint = CodeEvoTheme.extraColors.primaryBlue
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Módulo de Compras",
                                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                        color = CodeEvoTheme.extraColors.textPrimary
                                    )
                                }
                                Text(
                                    text = "Órdenes de compra a proveedores y recepción de mercancías",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = CodeEvoTheme.extraColors.textSecondary
                                )
                            }

                            CodeEvoButton(
                                text = "Nueva Orden",
                                onClick = { showCreatePurchaseFlow = true },
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
                                placeholder = "Buscar por folio de compra o proveedor..."
                            )

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

                    // List
                    if (uiState.filteredPurchases.isEmpty()) {
                        item {
                            CodeEvoEmptyState(
                                title = "No hay órdenes de compra",
                                description = "No se encontraron órdenes para el filtro seleccionado."
                            )
                        }
                    } else {
                        items(uiState.filteredPurchases, key = { it.id }) { purchase ->
                            PurchaseCardItem(
                                purchase = purchase,
                                onClick = { selectedPurchaseForDetail = purchase }
                            )
                        }
                    }
                }

                // Detail Dialog
                if (selectedPurchaseForDetail != null) {
                    PurchaseDetailDialog(
                        purchase = selectedPurchaseForDetail!!,
                        onReceiveInventory = { purchaseToReceive = selectedPurchaseForDetail },
                        onDismissRequest = { selectedPurchaseForDetail = null }
                    )
                }

                // Create Dialog
                if (showCreatePurchaseFlow) {
                    CreatePurchaseFlowDialog(
                        suppliers = uiState.suppliers,
                        products = uiState.products,
                        onSavePurchase = { newPurchase ->
                            actualViewModel.createPurchase(newPurchase)
                            showCreatePurchaseFlow = false
                        },
                        onDismissRequest = { showCreatePurchaseFlow = false }
                    )
                }
            }
        }
    }
}

@Composable
private fun PurchaseCardItem(
    purchase: Purchase,
    onClick: () -> Unit
) {
    val dateStr = remember(purchase.date) {
        SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(Date(purchase.date))
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
                        text = purchase.purchaseNumber,
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    CodeEvoStatusBadge(documentStatus = purchase.status)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Proveedor: ${purchase.supplierName} • Fecha: $dateStr",
                    style = MaterialTheme.typography.bodySmall,
                    color = CodeEvoTheme.extraColors.textSecondary
                )
            }

            CodeEvoMoneyDisplay(
                amount = purchase.totalAmount,
                textStyle = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = CodeEvoTheme.extraColors.primaryBlue
            )
        }
    }
}

@Composable
private fun PurchaseDetailDialog(
    purchase: Purchase,
    onReceiveInventory: () -> Unit,
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
                    text = "Orden de Compra #${purchase.purchaseNumber}",
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
                PurchaseSummary(purchase = purchase)
            }
        },
        confirmButton = {
            if (purchase.status == DocumentStatus.CONFIRMED || purchase.status == DocumentStatus.DRAFT) {
                CodeEvoButton(
                    text = "Recibir Inventario",
                    onClick = onReceiveInventory,
                    icon = Icons.Rounded.MoveToInbox,
                    backgroundColor = CodeEvoTheme.extraColors.success
                )
            }
        },
        dismissButton = {
            CodeEvoSecondaryButton(text = "Cerrar", onClick = onDismissRequest)
        }
    )
}

@Composable
private fun CreatePurchaseFlowDialog(
    suppliers: List<Supplier>,
    products: List<Product>,
    onSavePurchase: (Purchase) -> Unit,
    onDismissRequest: () -> Unit
) {
    var selectedSupplier by remember { mutableStateOf<Supplier?>(null) }
    var showSupplierSelector by remember { mutableStateOf(false) }

    var showProductSelector by remember { mutableStateOf(false) }
    val purchaseItems = remember { mutableStateListOf<PurchaseItem>() }

    var errorMsg by remember { mutableStateOf<String?>(null) }

    if (showSupplierSelector) {
        SupplierSelectorDialog(
            suppliers = suppliers,
            onSupplierSelected = { supp ->
                selectedSupplier = supp
                showSupplierSelector = false
            },
            onDismissRequest = { showSupplierSelector = false }
        )
    }

    if (showProductSelector) {
        ProductSelectorDialog(
            products = products,
            onProductSelected = { prod ->
                val existingIndex = purchaseItems.indexOfFirst { it.productId == prod.id }
                if (existingIndex != -1) {
                    val existing = purchaseItems[existingIndex]
                    val newQty = existing.quantity + 5
                    purchaseItems[existingIndex] = existing.copy(
                        quantity = newQty,
                        subtotal = newQty * existing.unitPrice
                    )
                } else {
                    purchaseItems.add(
                        PurchaseItem(
                            productId = prod.id,
                            productName = prod.name,
                            quantity = 5,
                            unitPrice = prod.costPrice,
                            subtotal = 5 * prod.costPrice
                        )
                    )
                }
                showProductSelector = false
            },
            onDismissRequest = { showProductSelector = false }
        )
    }

    val subtotal = purchaseItems.sumOf { it.subtotal }
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
                    text = "Nueva Orden de Compra",
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
                Column {
                    Text("1. Proveedor", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textSecondary)
                    Spacer(modifier = Modifier.height(6.dp))
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showSupplierSelector = true },
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
                                text = selectedSupplier?.name ?: "Seleccionar proveedor de la lista...",
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontWeight = if (selectedSupplier != null) FontWeight.Bold else FontWeight.Normal
                                ),
                                color = if (selectedSupplier != null) CodeEvoTheme.extraColors.textPrimary else CodeEvoTheme.extraColors.textSecondary
                            )
                            Text("Cambiar", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.primaryBlue)
                        }
                    }
                }

                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("2. Insumos / Artículos a solicitar", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textSecondary)
                        CodeEvoSecondaryButton(
                            text = "Agregar Insumo",
                            onClick = { showProductSelector = true },
                            icon = Icons.Rounded.Add
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    if (purchaseItems.isEmpty()) {
                        Text(
                            text = "Aún no ha agregado insumos a la orden de compra.",
                            style = MaterialTheme.typography.bodySmall,
                            color = CodeEvoTheme.extraColors.textSecondary
                        )
                    } else {
                        purchaseItems.forEachIndexed { index, item ->
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
                                        IconButton(onClick = { purchaseItems.removeAt(index) }) {
                                            Icon(Icons.Rounded.Delete, contentDescription = "Eliminar", tint = CodeEvoTheme.extraColors.danger)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                HorizontalDivider(color = CodeEvoTheme.extraColors.border.copy(alpha = 0.4f))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Total Estimado de Orden:", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                    CodeEvoMoneyDisplay(amount = totalAmount, textStyle = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.primaryBlue)
                }

                if (errorMsg != null) {
                    Text(errorMsg!!, style = MaterialTheme.typography.bodySmall, color = CodeEvoTheme.extraColors.danger)
                }
            }
        },
        confirmButton = {
            CodeEvoButton(
                text = "Generar Orden de Compra",
                onClick = {
                    if (selectedSupplier == null) {
                        errorMsg = "Seleccione un proveedor"
                    } else if (purchaseItems.isEmpty()) {
                        errorMsg = "Agregue al menos un insumo"
                    } else {
                        val newPurchase = Purchase(
                            id = "pur_${System.currentTimeMillis()}",
                            purchaseNumber = "PO-2025-${(400..999).random()}",
                            supplierId = selectedSupplier!!.id,
                            supplierName = selectedSupplier!!.name,
                            items = purchaseItems.toList(),
                            totalAmount = totalAmount,
                            date = System.currentTimeMillis(),
                            status = DocumentStatus.CONFIRMED
                        )
                        onSavePurchase(newPurchase)
                    }
                }
            )
        },
        dismissButton = {
            CodeEvoSecondaryButton(text = "Cancelar", onClick = onDismissRequest)
        }
    )
}
