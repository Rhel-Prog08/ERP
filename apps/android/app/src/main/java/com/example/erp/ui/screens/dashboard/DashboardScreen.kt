package com.example.erp.ui.screens.dashboard

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ArrowDownward
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material.icons.rounded.AttachMoney
import androidx.compose.material.icons.rounded.Business
import androidx.compose.material.icons.rounded.Category
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Inventory2
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.ShoppingCart
import androidx.compose.material.icons.rounded.TrendingUp
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.erp.ERPApplication
import com.example.erp.domain.model.AuditLog
import com.example.erp.domain.model.Product
import com.example.erp.domain.model.Sale
import com.example.erp.domain.model.TopProduct
import com.example.erp.domain.model.User
import com.example.erp.ui.components.CodeEvoBadge
import com.example.erp.ui.components.CodeEvoButton
import com.example.erp.ui.components.CodeEvoCard
import com.example.erp.ui.components.CodeEvoEmptyState
import com.example.erp.ui.components.CodeEvoMoneyDisplay
import com.example.erp.ui.components.CodeEvoSecondaryButton
import com.example.erp.ui.components.CodeEvoSkeletonList
import com.example.erp.ui.components.CodeEvoStatCard
import com.example.erp.ui.components.CodeEvoStatusBadge
import com.example.erp.ui.navigation.AuditRoute
import com.example.erp.ui.navigation.InventoryRoute
import com.example.erp.ui.navigation.SalesRoute
import com.example.erp.ui.theme.CodeEvoTheme
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun DashboardScreen(
    user: User?,
    onNavigateToRoute: (Any) -> Unit = {},
    viewModel: DashboardViewModel? = null
) {
    val context = LocalContext.current
    val actualViewModel: DashboardViewModel = viewModel ?: run {
        val app = context.applicationContext as ERPApplication
        viewModel(factory = DashboardViewModel.Factory(app.dashboardRepository))
    }

    val state by actualViewModel.uiState.collectAsState()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when (val uiState = state) {
            is DashboardUiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Cargando Panel Ejecutivo...",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    CodeEvoSkeletonList(itemCount = 4)
                }
            }

            is DashboardUiState.Error -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.ErrorOutline,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = CodeEvoTheme.extraColors.danger
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Error al cargar Dashboard",
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = uiState.message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = CodeEvoTheme.extraColors.textSecondary
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    CodeEvoButton(
                        text = "Reintentar",
                        onClick = { actualViewModel.loadDashboardData() },
                        icon = Icons.Rounded.Refresh
                    )
                }
            }

            is DashboardUiState.Content -> {
                DashboardContent(
                    user = user,
                    content = uiState,
                    onNavigateToRoute = onNavigateToRoute,
                    onRefresh = { actualViewModel.loadDashboardData() }
                )
            }
        }
    }
}

@Composable
private fun DashboardContent(
    user: User?,
    content: DashboardUiState.Content,
    onNavigateToRoute: (Any) -> Unit,
    onRefresh: () -> Unit
) {
    val todayFormatted = remember {
        SimpleDateFormat("EEEE, d 'de' MMMM yyyy", Locale("es", "ES")).format(Date())
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Welcome Banner
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = CodeEvoTheme.extraColors.surface2
                )
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            brush = Brush.horizontalGradient(
                                colors = listOf(
                                    CodeEvoTheme.extraColors.primaryBlue.copy(alpha = 0.12f),
                                    CodeEvoTheme.extraColors.cyan.copy(alpha = 0.05f)
                                )
                            )
                        )
                        .padding(24.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    shape = CircleShape,
                                    color = CodeEvoTheme.extraColors.primaryBlue
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Business,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier
                                            .padding(6.dp)
                                            .size(16.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "CodeEvo Systems • Matriz Principal",
                                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                                    color = CodeEvoTheme.extraColors.primaryBlue
                                )
                            }
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = "¡Bienvenido de nuevo, ${user?.name ?: "Director"}!",
                                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                                color = CodeEvoTheme.extraColors.textPrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Resumen de operaciones para hoy $todayFormatted",
                                style = MaterialTheme.typography.bodyMedium,
                                color = CodeEvoTheme.extraColors.textSecondary
                            )
                        }

                        CodeEvoSecondaryButton(
                            text = "Actualizar",
                            onClick = onRefresh,
                            icon = Icons.Rounded.Refresh
                        )
                    }
                }
            }
        }

        // KPI Grid
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "Indicadores Clave (KPIs)",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = CodeEvoTheme.extraColors.textPrimary
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    CodeEvoStatCard(
                        title = "Ventas de Hoy",
                        value = "$12,450.00",
                        changePercent = 12.5,
                        trendText = "vs ayer",
                        icon = Icons.Rounded.AttachMoney,
                        accentColor = CodeEvoTheme.extraColors.cyan,
                        modifier = Modifier.weight(1f)
                    )

                    CodeEvoStatCard(
                        title = "Ventas del Mes",
                        value = "$${String.format(Locale.US, "%,.2f", content.kpis.totalRevenue)}",
                        changePercent = content.kpis.revenueGrowthPercent,
                        trendText = "vs mes anterior",
                        icon = Icons.Rounded.TrendingUp,
                        accentColor = CodeEvoTheme.extraColors.primaryBlue,
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    CodeEvoStatCard(
                        title = "Compras del Mes",
                        value = "$${String.format(Locale.US, "%,.2f", content.kpis.totalExpenses)}",
                        changePercent = -3.4,
                        trendText = "vs prespuesto",
                        icon = Icons.AutoMirrored.Rounded.ReceiptLong,
                        accentColor = CodeEvoTheme.extraColors.warning,
                        modifier = Modifier.weight(1f)
                    )

                    CodeEvoStatCard(
                        title = "Stock Bajo",
                        value = "${content.kpis.lowStockItemsCount} productos",
                        changePercent = -15.0,
                        trendText = "alerta crítica",
                        icon = Icons.Rounded.Inventory2,
                        accentColor = CodeEvoTheme.extraColors.danger,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // Low Stock Alert Banner
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onNavigateToRoute(InventoryRoute) },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = CodeEvoTheme.extraColors.danger.copy(alpha = 0.12f)
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier.weight(1f),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = CodeEvoTheme.extraColors.danger
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Warning,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier
                                    .padding(8.dp)
                                    .size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "¡Alerta de Inventario Crítico!",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                color = CodeEvoTheme.extraColors.danger
                            )
                            Text(
                                text = "Hay ${content.lowStockProducts.size} productos por debajo del nivel de reabastecimiento mínimo.",
                                style = MaterialTheme.typography.bodySmall,
                                color = CodeEvoTheme.extraColors.textPrimary
                            )
                        }
                    }

                    CodeEvoButton(
                        text = "Ver Inventario",
                        onClick = { onNavigateToRoute(InventoryRoute) },
                        backgroundColor = CodeEvoTheme.extraColors.danger,
                        icon = Icons.AutoMirrored.Rounded.ArrowForward
                    )
                }
            }
        }

        // Performance visual representation (Monthly Target & Top Products)
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Monthly Revenue Target
                CodeEvoCard(
                    modifier = Modifier.weight(1f),
                    contentPadding = 20.dp
                ) {
                    Text(
                        text = "Meta de Ventas Mensual",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    val percent = (content.monthlyTargetCurrent / content.monthlyTargetRevenue).coerceIn(0.0, 1.0).toFloat()

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Bottom
                    ) {
                        Column {
                            CodeEvoMoneyDisplay(
                                amount = content.monthlyTargetCurrent,
                                textStyle = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                color = CodeEvoTheme.extraColors.primaryBlue
                            )
                            Text(
                                text = "de $300,000.00 meta",
                                style = MaterialTheme.typography.labelSmall,
                                color = CodeEvoTheme.extraColors.textSecondary
                            )
                        }
                        CodeEvoBadge(
                            text = "${(percent * 100).toInt()}% alcanzado",
                            backgroundColor = CodeEvoTheme.extraColors.primaryBlue.copy(alpha = 0.15f),
                            contentColor = CodeEvoTheme.extraColors.primaryBlue
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    LinearProgressIndicator(
                        progress = { percent },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(10.dp)
                            .clip(RoundedCornerShape(5.dp)),
                        color = CodeEvoTheme.extraColors.primaryBlue,
                        trackColor = CodeEvoTheme.extraColors.border.copy(alpha = 0.3f)
                    )
                }

                // Top Selling Products Visual Card
                CodeEvoCard(
                    modifier = Modifier.weight(1f),
                    contentPadding = 20.dp
                ) {
                    Text(
                        text = "Productos Más Vendidos",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        content.topProducts.take(3).forEach { topProd ->
                            Column {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = topProd.name,
                                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                                        color = CodeEvoTheme.extraColors.textPrimary,
                                        modifier = Modifier.weight(1f)
                                    )
                                    Text(
                                        text = "${topProd.unitsSold} uds",
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                        color = CodeEvoTheme.extraColors.cyan
                                    )
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                LinearProgressIndicator(
                                    progress = { topProd.targetProgress },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp)),
                                    color = CodeEvoTheme.extraColors.cyan,
                                    trackColor = CodeEvoTheme.extraColors.border.copy(alpha = 0.3f)
                                )
                            }
                        }
                    }
                }
            }
        }

        // Recent Sales Section
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Últimas Ventas Registradas",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    CodeEvoSecondaryButton(
                        text = "Ver Todas",
                        onClick = { onNavigateToRoute(SalesRoute) },
                        icon = Icons.AutoMirrored.Rounded.ArrowForward
                    )
                }

                if (content.recentSales.isEmpty()) {
                    CodeEvoEmptyState(
                        title = "Sin ventas recientes",
                        description = "No hay operaciones de venta en el periodo actual."
                    )
                } else {
                    content.recentSales.forEach { sale ->
                        CodeEvoCard(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onNavigateToRoute(SalesRoute) },
                            contentPadding = 16.dp
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = CodeEvoTheme.extraColors.cyan.copy(alpha = 0.15f)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Rounded.ShoppingCart,
                                            contentDescription = null,
                                            tint = CodeEvoTheme.extraColors.cyan,
                                            modifier = Modifier
                                                .padding(10.dp)
                                                .size(20.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(
                                            text = sale.saleNumber,
                                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                            color = CodeEvoTheme.extraColors.textPrimary
                                        )
                                        Text(
                                            text = sale.customerName,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = CodeEvoTheme.extraColors.textSecondary
                                        )
                                    }
                                }

                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    CodeEvoStatusBadge(documentStatus = sale.status)
                                    Spacer(modifier = Modifier.width(16.dp))
                                    CodeEvoMoneyDisplay(
                                        amount = sale.totalAmount,
                                        textStyle = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                        color = CodeEvoTheme.extraColors.textPrimary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Recent Activity Feed (Audit Log)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Rounded.History,
                            contentDescription = null,
                            tint = CodeEvoTheme.extraColors.primaryBlue
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Bitácora de Actividad Reciente",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = CodeEvoTheme.extraColors.textPrimary
                        )
                    }

                    CodeEvoSecondaryButton(
                        text = "Ver Auditoría",
                        onClick = { onNavigateToRoute(AuditRoute) },
                        icon = Icons.AutoMirrored.Rounded.ArrowForward
                    )
                }

                CodeEvoCard(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = 16.dp
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        content.recentAuditLogs.forEachIndexed { index, log ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Top
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(CodeEvoTheme.extraColors.primaryBlue.copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = log.userName.take(2).uppercase(),
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                        color = CodeEvoTheme.extraColors.primaryBlue
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "${log.userName} • ${log.action}",
                                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                            color = CodeEvoTheme.extraColors.textPrimary
                                        )
                                        CodeEvoBadge(text = log.targetModule)
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = log.details,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = CodeEvoTheme.extraColors.textSecondary
                                    )
                                }
                            }

                            if (index < content.recentAuditLogs.size - 1) {
                                HorizontalDivider(
                                    color = CodeEvoTheme.extraColors.border.copy(alpha = 0.3f),
                                    modifier = Modifier.padding(vertical = 4.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
