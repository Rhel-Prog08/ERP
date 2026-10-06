package com.example.erp.ui.screens.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.BarChart
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.erp.ERPApplication
import com.example.erp.domain.model.User
import com.example.erp.ui.components.CodeEvoButton
import com.example.erp.ui.components.CodeEvoCard
import com.example.erp.ui.components.CodeEvoEmptyState
import com.example.erp.ui.components.CodeEvoMoneyDisplay
import com.example.erp.ui.components.CodeEvoSkeletonList
import com.example.erp.ui.components.CodeEvoStatCard
import com.example.erp.ui.theme.CodeEvoTheme
import java.util.Locale

@Composable
fun ReportsScreen(
    user: User?,
    viewModel: ReportsViewModel? = null
) {
    val context = LocalContext.current
    val actualViewModel: ReportsViewModel = viewModel ?: run {
        val app = context.applicationContext as ERPApplication
        viewModel(factory = ReportsViewModel.Factory(app.dashboardRepository))
    }

    val state by actualViewModel.uiState.collectAsState()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when (val uiState = state) {
            is ReportsUiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(text = "Cargando Reportes y Analíticas...", style = MaterialTheme.typography.titleMedium, color = CodeEvoTheme.extraColors.textPrimary)
                    CodeEvoSkeletonList(itemCount = 4)
                }
            }

            is ReportsUiState.Error -> {
                CodeEvoEmptyState(
                    title = "Error al cargar reportes",
                    description = uiState.message,
                    actionText = "Reintentar",
                    onActionClick = { actualViewModel.loadReportData() }
                )
            }

            is ReportsUiState.Content -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Rounded.BarChart, contentDescription = null, tint = CodeEvoTheme.extraColors.primaryBlue)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Reportes y Analíticas", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                                }
                                Text("Informes financieros, rendimiento de ventas y distribución por categoría", style = MaterialTheme.typography.bodyMedium, color = CodeEvoTheme.extraColors.textSecondary)
                            }

                            CodeEvoButton(
                                text = "Exportar Informe",
                                onClick = { },
                                icon = Icons.Rounded.Download
                            )
                        }
                    }

                    // Period Filters
                    item {
                        val periods = listOf("Hoy", "Esta Semana", "Este Mes", "Año Actual")
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(periods) { period ->
                                FilterChip(
                                    selected = uiState.selectedPeriod == period,
                                    onClick = { actualViewModel.setPeriodFilter(period) },
                                    label = { Text(period, fontWeight = FontWeight.Bold) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = CodeEvoTheme.extraColors.primaryBlue,
                                        selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                                    )
                                )
                            }
                        }
                    }

                    // Executive KPIs
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            CodeEvoStatCard(
                                title = "Ingresos Totales",
                                value = "$${String.format(Locale.US, "%,.2f", uiState.totalRevenue)}",
                                changePercent = 14.2,
                                modifier = Modifier.weight(1f)
                            )
                            CodeEvoStatCard(
                                title = "Gastos Operativos",
                                value = "$${String.format(Locale.US, "%,.2f", uiState.totalExpenses)}",
                                changePercent = -2.1,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    // Visual Charts Section (Monthly Bar Chart comparison)
                    item {
                        CodeEvoCard(
                            modifier = Modifier.fillMaxWidth(),
                            contentPadding = 20.dp
                        ) {
                            Text(
                                text = "Comparativo Mensual: Ventas vs Compras",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = CodeEvoTheme.extraColors.textPrimary
                            )
                            Spacer(modifier = Modifier.height(16.dp))

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(180.dp),
                                horizontalArrangement = Arrangement.SpaceAround,
                                verticalAlignment = Alignment.Bottom
                            ) {
                                uiState.monthlyBars.forEach { bar ->
                                    val maxVal = 300000.0
                                    val salesHeight = (bar.sales / maxVal * 140).coerceAtLeast(10.0).dp
                                    val purchaseHeight = (bar.purchases / maxVal * 140).coerceAtLeast(10.0).dp

                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Bottom,
                                        modifier = Modifier.fillMaxHeight()
                                    ) {
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                                            verticalAlignment = Alignment.Bottom
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .width(18.dp)
                                                    .height(salesHeight)
                                                    .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                                    .background(CodeEvoTheme.extraColors.primaryBlue)
                                            )
                                            Box(
                                                modifier = Modifier
                                                    .width(18.dp)
                                                    .height(purchaseHeight)
                                                    .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                                    .background(CodeEvoTheme.extraColors.cyan)
                                            )
                                        }
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text(bar.month, style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textSecondary)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(12.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(modifier = Modifier.width(12.dp).height(12.dp).background(CodeEvoTheme.extraColors.primaryBlue, RoundedCornerShape(2.dp)))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Ventas", style = MaterialTheme.typography.labelSmall, color = CodeEvoTheme.extraColors.textSecondary)
                                Spacer(modifier = Modifier.width(16.dp))
                                Box(modifier = Modifier.width(12.dp).height(12.dp).background(CodeEvoTheme.extraColors.cyan, RoundedCornerShape(2.dp)))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Compras", style = MaterialTheme.typography.labelSmall, color = CodeEvoTheme.extraColors.textSecondary)
                            }
                        }
                    }

                    // Category Breakdown
                    item {
                        CodeEvoCard(
                            modifier = Modifier.fillMaxWidth(),
                            contentPadding = 20.dp
                        ) {
                            Text(
                                text = "Distribución de Ventas por Categoría",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = CodeEvoTheme.extraColors.textPrimary
                            )
                            Spacer(modifier = Modifier.height(16.dp))

                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                uiState.categoryBreakdown.forEach { cat ->
                                    Column {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(cat.category, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                                            CodeEvoMoneyDisplay(amount = cat.amount, textStyle = MaterialTheme.typography.bodyMedium, color = CodeEvoTheme.extraColors.cyan)
                                        }
                                        Spacer(modifier = Modifier.height(6.dp))
                                        LinearProgressIndicator(
                                            progress = { cat.percentage },
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .height(8.dp)
                                                .clip(RoundedCornerShape(4.dp)),
                                            color = CodeEvoTheme.extraColors.cyan,
                                            trackColor = CodeEvoTheme.extraColors.border.copy(alpha = 0.3f)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
