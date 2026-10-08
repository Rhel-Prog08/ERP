package com.codeevo.erp.ui.screens.inventory

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Inventory2
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
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
import com.codeevo.erp.data.repository.InventoryMovement
import com.codeevo.erp.domain.model.InventoryItem
import com.codeevo.erp.domain.model.User
import com.codeevo.erp.ui.components.CodeEvoBadge
import com.codeevo.erp.ui.components.CodeEvoButton
import com.codeevo.erp.ui.components.CodeEvoCard
import com.codeevo.erp.ui.components.CodeEvoEmptyState
import com.codeevo.erp.ui.components.CodeEvoSearchField
import com.codeevo.erp.ui.components.CodeEvoSkeletonList
import com.codeevo.erp.ui.components.CodeEvoStatusBadge
import com.codeevo.erp.ui.components.erp.InventoryMovementDialog
import com.codeevo.erp.ui.theme.CodeEvoTheme
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    user: User?,
    viewModel: InventoryViewModel? = null
) {
    val context = LocalContext.current
    val actualViewModel: InventoryViewModel = viewModel ?: run {
        val app = context.applicationContext as ERPApplication
        viewModel(factory = InventoryViewModel.Factory(app.productRepository))
    }

    val state by actualViewModel.uiState.collectAsState()
    var showMovementDialog by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when (val uiState = state) {
            is InventoryUiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Cargando Control de Inventario...",
                        style = MaterialTheme.typography.titleMedium,
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    CodeEvoSkeletonList(itemCount = 5)
                }
            }

            is InventoryUiState.Error -> {
                CodeEvoEmptyState(
                    title = "Error al cargar inventario",
                    description = uiState.message,
                    actionText = "Reintentar",
                    onActionClick = { actualViewModel.loadInventory() }
                )
            }

            is InventoryUiState.Content -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Title Header
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Rounded.Inventory2,
                                        contentDescription = null,
                                        tint = CodeEvoTheme.extraColors.primaryBlue
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Control de Inventario",
                                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                        color = CodeEvoTheme.extraColors.textPrimary
                                    )
                                }
                                Text(
                                    text = "Stock por almacén, puntos de reorden y kardex de movimientos",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = CodeEvoTheme.extraColors.textSecondary
                                )
                            }

                            CodeEvoButton(
                                text = "Nuevo Movimiento",
                                onClick = { showMovementDialog = true },
                                icon = Icons.Rounded.Add
                            )
                        }
                    }

                    // Tabs
                    item {
                        PrimaryTabRow(
                            selectedTabIndex = uiState.selectedTab,
                            containerColor = CodeEvoTheme.extraColors.surface2,
                            contentColor = CodeEvoTheme.extraColors.primaryBlue
                        ) {
                            Tab(
                                selected = uiState.selectedTab == 0,
                                onClick = { actualViewModel.setSelectedTab(0) },
                                text = { Text("Existencias y Stock", fontWeight = FontWeight.Bold) }
                            )
                            Tab(
                                selected = uiState.selectedTab == 1,
                                onClick = { actualViewModel.setSelectedTab(1) },
                                text = { Text("Historial Kardex (${uiState.movements.size})", fontWeight = FontWeight.Bold) }
                            )
                        }
                    }

                    // Content based on tab
                    if (uiState.selectedTab == 0) {
                        item {
                            CodeEvoSearchField(
                                value = uiState.searchQuery,
                                onValueChange = { actualViewModel.setSearchQuery(it) },
                                placeholder = "Buscar en inventario por producto o ubicación..."
                            )
                        }

                        if (uiState.filteredItems.isEmpty()) {
                            item {
                                CodeEvoEmptyState(
                                    title = "Sin existencias registradas",
                                    description = "No se encontraron elementos en inventario para el filtro seleccionado."
                                )
                            }
                        } else {
                            items(uiState.filteredItems, key = { it.id }) { item ->
                                InventoryItemCard(item = item)
                            }
                        }
                    } else {
                        // Movements tab
                        if (uiState.movements.isEmpty()) {
                            item {
                                CodeEvoEmptyState(
                                    title = "Sin movimientos registrados",
                                    description = "No se han realizado entradas, salidas o ajustes aún."
                                )
                            }
                        } else {
                            items(uiState.movements, key = { it.id }) { mov ->
                                MovementCardItem(movement = mov)
                            }
                        }
                    }
                }

                // New Movement Dialog
                if (showMovementDialog) {
                    InventoryMovementDialog(
                        products = uiState.products,
                        onConfirmMovement = { productId, type, quantity, reason ->
                            actualViewModel.recordMovement(productId, type, quantity, reason)
                        },
                        onDismissRequest = { showMovementDialog = false }
                    )
                }
            }
        }
    }
}

@Composable
private fun InventoryItemCard(item: InventoryItem) {
    CodeEvoCard(
        modifier = Modifier.fillMaxWidth(),
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
                        text = item.productName,
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    CodeEvoStatusBadge(inventoryStatus = item.status)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "SKU: ${item.sku} • Ubicación: ${item.location}",
                    style = MaterialTheme.typography.bodySmall,
                    color = CodeEvoTheme.extraColors.textSecondary
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${item.quantityOnHand} uds",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = CodeEvoTheme.extraColors.primaryBlue
                )
                Text(
                    text = "Punto reorden: ${item.reorderPoint}",
                    style = MaterialTheme.typography.labelSmall,
                    color = CodeEvoTheme.extraColors.textSecondary
                )
            }
        }
    }
}

@Composable
private fun MovementCardItem(movement: InventoryMovement) {
    val dateStr = remember(movement.date) {
        SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault()).format(Date(movement.date))
    }

    val (bg, fg) = when (movement.type.uppercase()) {
        "ENTRADA" -> CodeEvoTheme.extraColors.success.copy(alpha = 0.15f) to CodeEvoTheme.extraColors.success
        "SALIDA" -> CodeEvoTheme.extraColors.danger.copy(alpha = 0.15f) to CodeEvoTheme.extraColors.danger
        "DEVOLUCIÓN" -> CodeEvoTheme.extraColors.cyan.copy(alpha = 0.15f) to CodeEvoTheme.extraColors.cyan
        else -> CodeEvoTheme.extraColors.warning.copy(alpha = 0.15f) to CodeEvoTheme.extraColors.warning
    }

    CodeEvoCard(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = 14.dp
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CodeEvoBadge(
                        text = movement.type,
                        backgroundColor = bg,
                        contentColor = fg
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = movement.productName,
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = movement.reason,
                    style = MaterialTheme.typography.bodySmall,
                    color = CodeEvoTheme.extraColors.textSecondary
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${if (movement.type == "SALIDA") "-" else "+"}${movement.quantity} uds",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = fg
                )
                Text(
                    text = dateStr,
                    style = MaterialTheme.typography.labelSmall,
                    color = CodeEvoTheme.extraColors.textSecondary
                )
            }
        }
    }
}
