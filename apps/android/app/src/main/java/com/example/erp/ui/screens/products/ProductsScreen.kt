package com.example.erp.ui.screens.products

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
import androidx.compose.material.icons.rounded.Category
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Edit
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.erp.ERPApplication
import com.example.erp.domain.model.InventoryStatus
import com.example.erp.domain.model.Product
import com.example.erp.domain.model.User
import com.example.erp.ui.components.CodeEvoBadge
import com.example.erp.ui.components.CodeEvoButton
import com.example.erp.ui.components.CodeEvoCard
import com.example.erp.ui.components.CodeEvoEmptyState
import com.example.erp.ui.components.CodeEvoMoneyDisplay
import com.example.erp.ui.components.CodeEvoSearchField
import com.example.erp.ui.components.CodeEvoSecondaryButton
import com.example.erp.ui.components.CodeEvoSkeletonList
import com.example.erp.ui.components.CodeEvoStatusBadge
import com.example.erp.ui.components.CodeEvoTextField
import com.example.erp.ui.theme.CodeEvoTheme

@Composable
fun ProductsScreen(
    user: User?,
    viewModel: ProductsViewModel? = null
) {
    val context = LocalContext.current
    val actualViewModel: ProductsViewModel = viewModel ?: run {
        val app = context.applicationContext as ERPApplication
        viewModel(factory = ProductsViewModel.Factory(app.productRepository))
    }

    val state by actualViewModel.uiState.collectAsState()

    var selectedProductForDetail by remember { mutableStateOf<Product?>(null) }
    var selectedProductForEdit by remember { mutableStateOf<Product?>(null) }
    var showCreateDialog by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when (val uiState = state) {
            is ProductsUiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Cargando Catálogo de Productos...",
                        style = MaterialTheme.typography.titleMedium,
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    CodeEvoSkeletonList(itemCount = 5)
                }
            }

            is ProductsUiState.Error -> {
                CodeEvoEmptyState(
                    title = "Error al cargar catálogo",
                    description = uiState.message,
                    actionText = "Reintentar",
                    onActionClick = { actualViewModel.loadProducts() }
                )
            }

            is ProductsUiState.Content -> {
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
                                        imageVector = Icons.Rounded.Category,
                                        contentDescription = null,
                                        tint = CodeEvoTheme.extraColors.primaryBlue
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Catálogo de Productos",
                                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                        color = CodeEvoTheme.extraColors.textPrimary
                                    )
                                }
                                Text(
                                    text = "Gestión de artículos, SKUs, precios y niveles de stock",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = CodeEvoTheme.extraColors.textSecondary
                                )
                            }

                            CodeEvoButton(
                                text = "Nuevo Producto",
                                onClick = { showCreateDialog = true },
                                icon = Icons.Rounded.Add
                            )
                        }
                    }

                    // Search & Category Filters
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            CodeEvoSearchField(
                                value = uiState.searchQuery,
                                onValueChange = { actualViewModel.setSearchQuery(it) },
                                placeholder = "Buscar por SKU, nombre o categoría..."
                            )

                            // Categories Filter Chips
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(uiState.categories) { category ->
                                    FilterChip(
                                        selected = uiState.selectedCategory == category,
                                        onClick = { actualViewModel.setCategoryFilter(category) },
                                        label = { Text(category, fontWeight = FontWeight.SemiBold) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = CodeEvoTheme.extraColors.primaryBlue,
                                            selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                                        )
                                    )
                                }
                            }

                            // Status Filter Chips
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                val statuses = listOf("Todos", "Normal", "Bajo Stock", "Agotado")
                                items(statuses) { status ->
                                    FilterChip(
                                        selected = uiState.selectedStatus == status,
                                        onClick = { actualViewModel.setStatusFilter(status) },
                                        label = { Text(status) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = CodeEvoTheme.extraColors.cyan,
                                            selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                                        )
                                    )
                                }
                            }
                        }
                    }

                    // Product Cards
                    if (uiState.filteredProducts.isEmpty()) {
                        item {
                            CodeEvoEmptyState(
                                title = "No hay productos que coincidan",
                                description = "Intente cambiando los términos de búsqueda o filtros seleccionados."
                            )
                        }
                    } else {
                        items(uiState.filteredProducts, key = { it.id }) { product ->
                            ProductCardItem(
                                product = product,
                                onClick = { selectedProductForDetail = product }
                            )
                        }
                    }
                }
            }
        }
    }

    // Detail Dialog
    if (selectedProductForDetail != null) {
        ProductDetailDialog(
            product = selectedProductForDetail!!,
            onDismissRequest = { selectedProductForDetail = null },
            onEdit = {
                val prod = selectedProductForDetail!!
                selectedProductForDetail = null
                selectedProductForEdit = prod
            }
        )
    }

    // Create or Edit Dialog
    if (showCreateDialog || selectedProductForEdit != null) {
        ProductFormDialog(
            initialProduct = selectedProductForEdit,
            onSave = { product ->
                if (selectedProductForEdit != null) {
                    actualViewModel.updateProduct(product)
                } else {
                    actualViewModel.addProduct(product)
                }
                showCreateDialog = false
                selectedProductForEdit = null
            },
            onDismissRequest = {
                showCreateDialog = false
                selectedProductForEdit = null
            }
        )
    }
}

@Composable
private fun ProductCardItem(
    product: Product,
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
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = product.name,
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    CodeEvoBadge(text = product.category)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = product.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = CodeEvoTheme.extraColors.textSecondary,
                    maxLines = 2
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "SKU: ${product.sku}",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
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
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(horizontalAlignment = Alignment.End) {
                CodeEvoMoneyDisplay(
                    amount = product.price,
                    textStyle = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = CodeEvoTheme.extraColors.cyan
                )
                Text(
                    text = "Costo: $${product.costPrice}",
                    style = MaterialTheme.typography.labelSmall,
                    color = CodeEvoTheme.extraColors.textSecondary
                )
            }
        }
    }
}

@Composable
private fun ProductDetailDialog(
    product: Product,
    onDismissRequest: () -> Unit,
    onEdit: () -> Unit
) {
    val marginPercent = if (product.price > 0) ((product.price - product.costPrice) / product.price * 100) else 0.0

    AlertDialog(
        onDismissRequest = onDismissRequest,
        containerColor = CodeEvoTheme.extraColors.surface2,
        shape = RoundedCornerShape(20.dp),
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = product.name,
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
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CodeEvoBadge(text = product.category)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "SKU: ${product.sku}",
                        style = MaterialTheme.typography.labelMedium,
                        color = CodeEvoTheme.extraColors.textSecondary
                    )
                }

                Text(
                    text = product.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = CodeEvoTheme.extraColors.textPrimary
                )

                HorizontalDivider(color = CodeEvoTheme.extraColors.border.copy(alpha = 0.4f))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("Precio Venta", style = MaterialTheme.typography.labelMedium, color = CodeEvoTheme.extraColors.textSecondary)
                        CodeEvoMoneyDisplay(amount = product.price, color = CodeEvoTheme.extraColors.cyan)
                    }
                    Column {
                        Text("Costo Adquisición", style = MaterialTheme.typography.labelMedium, color = CodeEvoTheme.extraColors.textSecondary)
                        CodeEvoMoneyDisplay(amount = product.costPrice, color = CodeEvoTheme.extraColors.textPrimary)
                    }
                    Column {
                        Text("Margen Bruto", style = MaterialTheme.typography.labelMedium, color = CodeEvoTheme.extraColors.textSecondary)
                        Text(
                            text = "${String.format("%.1f", marginPercent)}%",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = CodeEvoTheme.extraColors.primaryBlue
                        )
                    }
                }

                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = CodeEvoTheme.extraColors.border.copy(alpha = 0.2f))
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("Inventario", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Stock actual: ${product.stockQuantity} ${product.unit}", style = MaterialTheme.typography.bodyMedium, color = CodeEvoTheme.extraColors.textPrimary)
                        Text("Mínimo reabastecimiento: ${product.minStockLevel} ${product.unit}", style = MaterialTheme.typography.bodySmall, color = CodeEvoTheme.extraColors.textSecondary)
                    }
                }
            }
        },
        confirmButton = {
            CodeEvoButton(
                text = "Editar Producto",
                onClick = onEdit,
                icon = Icons.Rounded.Edit
            )
        },
        dismissButton = {
            CodeEvoSecondaryButton(text = "Cerrar", onClick = onDismissRequest)
        }
    )
}

@Composable
private fun ProductFormDialog(
    initialProduct: Product?,
    onSave: (Product) -> Unit,
    onDismissRequest: () -> Unit
) {
    var sku by remember { mutableStateOf(initialProduct?.sku ?: "") }
    var name by remember { mutableStateOf(initialProduct?.name ?: "") }
    var description by remember { mutableStateOf(initialProduct?.description ?: "") }
    var category by remember { mutableStateOf(initialProduct?.category ?: "Hardware") }
    var priceText by remember { mutableStateOf(initialProduct?.price?.toString() ?: "") }
    var costPriceText by remember { mutableStateOf(initialProduct?.costPrice?.toString() ?: "") }
    var stockText by remember { mutableStateOf(initialProduct?.stockQuantity?.toString() ?: "10") }
    var minStockText by remember { mutableStateOf(initialProduct?.minStockLevel?.toString() ?: "5") }
    var unit by remember { mutableStateOf(initialProduct?.unit ?: "pcs") }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismissRequest,
        containerColor = CodeEvoTheme.extraColors.surface2,
        shape = RoundedCornerShape(20.dp),
        title = {
            Text(
                text = if (initialProduct == null) "Nuevo Producto" else "Editar Producto",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = CodeEvoTheme.extraColors.textPrimary
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                CodeEvoTextField(value = sku, onValueChange = { sku = it }, label = "SKU / Código", placeholder = "SKU-1001")
                CodeEvoTextField(value = name, onValueChange = { name = it }, label = "Nombre del Producto", placeholder = "CodeEvo Laptop Pro")
                CodeEvoTextField(value = description, onValueChange = { description = it }, label = "Descripción", placeholder = "Detalles y especificaciones", singleLine = false)
                CodeEvoTextField(value = category, onValueChange = { category = it }, label = "Categoría", placeholder = "Hardware, Software, etc.")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CodeEvoTextField(value = priceText, onValueChange = { priceText = it }, label = "Precio Venta", placeholder = "99.99", modifier = Modifier.weight(1f))
                    CodeEvoTextField(value = costPriceText, onValueChange = { costPriceText = it }, label = "Costo Adquisición", placeholder = "50.00", modifier = Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CodeEvoTextField(value = stockText, onValueChange = { stockText = it }, label = "Stock Inicial", placeholder = "10", modifier = Modifier.weight(1f))
                    CodeEvoTextField(value = minStockText, onValueChange = { minStockText = it }, label = "Stock Mínimo", placeholder = "5", modifier = Modifier.weight(1f))
                    CodeEvoTextField(value = unit, onValueChange = { unit = it }, label = "Unidad", placeholder = "pcs", modifier = Modifier.weight(1f))
                }

                if (errorMsg != null) {
                    Text(errorMsg!!, color = CodeEvoTheme.extraColors.danger, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            CodeEvoButton(
                text = "Guardar",
                onClick = {
                    if (sku.isBlank() || name.isBlank()) {
                        errorMsg = "Por favor ingrese SKU y Nombre"
                    } else {
                        val price = priceText.toDoubleOrNull() ?: 0.0
                        val cost = costPriceText.toDoubleOrNull() ?: 0.0
                        val stock = stockText.toIntOrNull() ?: 0
                        val minStock = minStockText.toIntOrNull() ?: 0

                        val prod = Product(
                            id = initialProduct?.id ?: "prod_${System.currentTimeMillis()}",
                            sku = sku,
                            name = name,
                            description = description,
                            category = category,
                            price = price,
                            costPrice = cost,
                            stockQuantity = stock,
                            minStockLevel = minStock,
                            unit = unit
                        )
                        onSave(prod)
                    }
                }
            )
        },
        dismissButton = {
            CodeEvoSecondaryButton(text = "Cancelar", onClick = onDismissRequest)
        }
    )
}
