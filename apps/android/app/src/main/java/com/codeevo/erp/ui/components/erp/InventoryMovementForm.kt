package com.codeevo.erp.ui.components.erp

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Inventory2
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.codeevo.erp.domain.model.Product
import com.codeevo.erp.ui.components.CodeEvoButton
import com.codeevo.erp.ui.components.CodeEvoConfirmDialog
import com.codeevo.erp.ui.components.CodeEvoSecondaryButton
import com.codeevo.erp.ui.components.CodeEvoTextField
import com.codeevo.erp.ui.theme.CodeEvoTheme

@Composable
fun InventoryMovementDialog(
    products: List<Product>,
    onConfirmMovement: (productId: String, type: String, quantity: Int, reason: String) -> Unit,
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedProduct by remember { mutableStateOf<Product?>(null) }
    var showProductSelector by remember { mutableStateOf(false) }

    val movementTypes = listOf("ENTRADA", "SALIDA", "AJUSTE", "DEVOLUCIÓN")
    var selectedType by remember { mutableStateOf("ENTRADA") }

    var quantityText by remember { mutableStateOf("1") }
    var reasonText by remember { mutableStateOf("") }

    var showConfirmDialog by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    if (showProductSelector) {
        ProductSelectorDialog(
            products = products,
            onProductSelected = { prod ->
                selectedProduct = prod
                showProductSelector = false
            },
            onDismissRequest = { showProductSelector = false }
        )
    }

    if (showConfirmDialog && selectedProduct != null) {
        val qty = quantityText.toIntOrNull() ?: 1
        CodeEvoConfirmDialog(
            title = "Confirmar Movimiento de Inventario",
            message = "¿Está seguro de registrar un movimiento de tipo $selectedType para ${selectedProduct?.name} con $qty unidades?",
            confirmText = "Ejecutar Movimiento",
            dismissText = "Cancelar",
            onConfirm = {
                onConfirmMovement(
                    selectedProduct!!.id,
                    selectedType,
                    qty,
                    reasonText.ifBlank { "Movimiento $selectedType" }
                )
                onDismissRequest()
            },
            onDismiss = { showConfirmDialog = false }
        )
    }

    AlertDialog(
        onDismissRequest = onDismissRequest,
        modifier = modifier.fillMaxWidth(0.92f),
        containerColor = CodeEvoTheme.extraColors.surface2,
        shape = RoundedCornerShape(20.dp),
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Rounded.Inventory2,
                        contentDescription = null,
                        tint = CodeEvoTheme.extraColors.primaryBlue
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Nuevo Movimiento de Stock",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                }
                IconButton(onClick = onDismissRequest) {
                    Icon(
                        imageVector = Icons.Rounded.Close,
                        contentDescription = "Cerrar",
                        tint = CodeEvoTheme.extraColors.textSecondary
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Product selector button/card
                Column {
                    Text(
                        text = "Producto",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium),
                        color = CodeEvoTheme.extraColors.textSecondary
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showProductSelector = true },
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = CodeEvoTheme.extraColors.border.copy(alpha = 0.2f)
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = selectedProduct?.name ?: "Seleccionar producto de la lista...",
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontWeight = if (selectedProduct != null) FontWeight.Bold else FontWeight.Normal
                                ),
                                color = if (selectedProduct != null) CodeEvoTheme.extraColors.textPrimary else CodeEvoTheme.extraColors.textSecondary
                            )
                            Text(
                                text = "Cambiar",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = CodeEvoTheme.extraColors.primaryBlue
                            )
                        }
                    }
                }

                // Movement type chips
                Column {
                    Text(
                        text = "Tipo de Movimiento",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium),
                        color = CodeEvoTheme.extraColors.textSecondary
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        movementTypes.forEach { type ->
                            FilterChip(
                                selected = selectedType == type,
                                onClick = { selectedType = type },
                                label = {
                                    Text(
                                        text = type,
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold)
                                    )
                                },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = CodeEvoTheme.extraColors.primaryBlue,
                                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                                )
                            )
                        }
                    }
                }

                // Quantity input
                CodeEvoTextField(
                    value = quantityText,
                    onValueChange = { quantityText = it.filter { c -> c.isDigit() } },
                    label = "Cantidad",
                    placeholder = "1"
                )

                // Reason input
                CodeEvoTextField(
                    value = reasonText,
                    onValueChange = { reasonText = it },
                    label = "Motivo / Observaciones",
                    placeholder = "Ej. Ajuste de conteo físico, recepción de compra...",
                    singleLine = false
                )

                if (errorMessage != null) {
                    Text(
                        text = errorMessage!!,
                        style = MaterialTheme.typography.bodySmall,
                        color = CodeEvoTheme.extraColors.danger
                    )
                }
            }
        },
        confirmButton = {
            CodeEvoButton(
                text = "Siguiente",
                onClick = {
                    if (selectedProduct == null) {
                        errorMessage = "Debe seleccionar un producto"
                    } else if (quantityText.toIntOrNull() == null || quantityText.toInt() <= 0) {
                        errorMessage = "Ingrese una cantidad válida mayor a 0"
                    } else {
                        errorMessage = null
                        showConfirmDialog = true
                    }
                }
            )
        },
        dismissButton = {
            CodeEvoSecondaryButton(
                text = "Cancelar",
                onClick = onDismissRequest
            )
        }
    )
}
