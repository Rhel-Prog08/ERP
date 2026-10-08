package com.codeevo.erp.ui.components.erp

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Category
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.codeevo.erp.domain.model.InventoryStatus
import com.codeevo.erp.domain.model.Product
import com.codeevo.erp.ui.components.CodeEvoBadge
import com.codeevo.erp.ui.components.CodeEvoMoneyDisplay
import com.codeevo.erp.ui.components.CodeEvoSearchField
import com.codeevo.erp.ui.components.CodeEvoStatusBadge
import com.codeevo.erp.ui.theme.CodeEvoTheme

@Composable
fun ProductSelectorDialog(
    products: List<Product>,
    onProductSelected: (Product) -> Unit,
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }

    val filteredProducts = remember(searchQuery, products) {
        if (searchQuery.isBlank()) products
        else products.filter {
            it.name.contains(searchQuery, ignoreCase = true) ||
                    it.sku.contains(searchQuery, ignoreCase = true) ||
                    it.category.contains(searchQuery, ignoreCase = true)
        }
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
                        imageVector = Icons.Rounded.Category,
                        contentDescription = null,
                        tint = CodeEvoTheme.extraColors.primaryBlue
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Seleccionar Producto",
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
                    .height(400.dp)
            ) {
                CodeEvoSearchField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = "Buscar por nombre, SKU o categoría..."
                )

                Spacer(modifier = Modifier.height(12.dp))

                if (filteredProducts.isEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "No se encontraron productos",
                            style = MaterialTheme.typography.bodyMedium,
                            color = CodeEvoTheme.extraColors.textSecondary
                        )
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filteredProducts, key = { it.id }) { product ->
                            ProductSelectorItem(
                                product = product,
                                onClick = {
                                    onProductSelected(product)
                                    onDismissRequest()
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismissRequest) {
                Text("Cancelar", color = CodeEvoTheme.extraColors.textSecondary)
            }
        }
    )
}

@Composable
fun ProductSelectorItem(
    product: Product,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = CodeEvoTheme.extraColors.border.copy(alpha = 0.2f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = product.name,
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    CodeEvoBadge(text = product.category)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "SKU: ${product.sku}",
                        style = MaterialTheme.typography.labelSmall,
                        color = CodeEvoTheme.extraColors.textSecondary
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    val invStatus = when {
                        product.stockQuantity <= 0 -> InventoryStatus.OUT_OF_STOCK
                        product.stockQuantity <= product.minStockLevel -> InventoryStatus.LOW
                        else -> InventoryStatus.NORMAL
                    }
                    CodeEvoStatusBadge(inventoryStatus = invStatus)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Stock: ${product.stockQuantity} ${product.unit}",
                        style = MaterialTheme.typography.labelSmall,
                        color = CodeEvoTheme.extraColors.textSecondary
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            CodeEvoMoneyDisplay(
                amount = product.price,
                textStyle = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = CodeEvoTheme.extraColors.cyan
            )
        }
    }
}
