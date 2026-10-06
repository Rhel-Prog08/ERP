package com.example.erp.ui.screens.audit

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.FactCheck
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Code
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.erp.ERPApplication
import com.example.erp.domain.model.AuditLog
import com.example.erp.domain.model.User
import com.example.erp.ui.components.CodeEvoBadge
import com.example.erp.ui.components.CodeEvoButton
import com.example.erp.ui.components.CodeEvoCard
import com.example.erp.ui.components.CodeEvoEmptyState
import com.example.erp.ui.components.CodeEvoSearchField
import com.example.erp.ui.components.CodeEvoSecondaryButton
import com.example.erp.ui.components.CodeEvoSkeletonList
import com.example.erp.ui.theme.CodeEvoTheme
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun AuditScreen(
    user: User?,
    viewModel: AuditViewModel? = null
) {
    val context = LocalContext.current
    val actualViewModel: AuditViewModel = viewModel ?: run {
        val app = context.applicationContext as ERPApplication
        viewModel(factory = AuditViewModel.Factory(app.auditRepository))
    }

    val state by actualViewModel.uiState.collectAsState()
    var selectedLogForDiff by remember { mutableStateOf<AuditLog?>(null) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when (val uiState = state) {
            is AuditUiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(text = "Cargando Bitácora de Auditoría...", style = MaterialTheme.typography.titleMedium, color = CodeEvoTheme.extraColors.textPrimary)
                    CodeEvoSkeletonList(itemCount = 5)
                }
            }

            is AuditUiState.Error -> {
                CodeEvoEmptyState(
                    title = "Error al cargar auditoría",
                    description = uiState.message,
                    actionText = "Reintentar",
                    onActionClick = { actualViewModel.loadAuditLogs() }
                )
            }

            is AuditUiState.Content -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.AutoMirrored.Rounded.FactCheck, contentDescription = null, tint = CodeEvoTheme.extraColors.primaryBlue)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Registro de Auditoría", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                            }
                            Text("Trazabilidad completa de operaciones, cambios de estado e inspección de payloads", style = MaterialTheme.typography.bodyMedium, color = CodeEvoTheme.extraColors.textSecondary)
                        }
                    }

                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            CodeEvoSearchField(
                                value = uiState.searchQuery,
                                onValueChange = { actualViewModel.setSearchQuery(it) },
                                placeholder = "Buscar en bitácora por usuario, acción o detalles..."
                            )

                            val modules = listOf("Todos", "Inventario", "Ventas", "Compras", "Clientes", "CRM")
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(modules) { mod ->
                                    FilterChip(
                                        selected = uiState.selectedModule.equals(mod, ignoreCase = true),
                                        onClick = { actualViewModel.setModuleFilter(mod) },
                                        label = { Text(mod, fontWeight = FontWeight.SemiBold) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = CodeEvoTheme.extraColors.primaryBlue,
                                            selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                                        )
                                    )
                                }
                            }
                        }
                    }

                    if (uiState.filteredLogs.isEmpty()) {
                        item {
                            CodeEvoEmptyState(title = "No hay eventos en auditoría", description = "No existen registros para los filtros ingresados.")
                        }
                    } else {
                        items(uiState.filteredLogs, key = { it.id }) { log ->
                            AuditLogCardItem(
                                log = log,
                                onClick = { selectedLogForDiff = log }
                            )
                        }
                    }
                }

                // Diff Dialog
                if (selectedLogForDiff != null) {
                    PayloadDiffDialog(
                        log = selectedLogForDiff!!,
                        onDismissRequest = { selectedLogForDiff = null }
                    )
                }
            }
        }
    }
}

@Composable
private fun AuditLogCardItem(
    log: AuditLog,
    onClick: () -> Unit
) {
    val timeStr = remember(log.timestamp) {
        SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.getDefault()).format(Date(log.timestamp))
    }

    CodeEvoCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        contentPadding = 16.dp
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(CodeEvoTheme.extraColors.primaryBlue.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = log.userName.take(2).uppercase(),
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(log.userName, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                        Spacer(modifier = Modifier.width(8.dp))
                        CodeEvoBadge(text = log.action)
                    }
                    CodeEvoBadge(
                        text = log.targetModule,
                        backgroundColor = CodeEvoTheme.extraColors.cyan.copy(alpha = 0.15f),
                        contentColor = CodeEvoTheme.extraColors.cyan
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))
                Text(log.details, style = MaterialTheme.typography.bodyMedium, color = CodeEvoTheme.extraColors.textPrimary)
                Spacer(modifier = Modifier.height(6.dp))
                Text("Timestamp: $timeStr", style = MaterialTheme.typography.labelSmall, color = CodeEvoTheme.extraColors.textSecondary)
            }
        }
    }
}

@Composable
private fun PayloadDiffDialog(
    log: AuditLog,
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
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Code, contentDescription = null, tint = CodeEvoTheme.extraColors.primaryBlue)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Inspección Payload Diff", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                }
                IconButton(onClick = onDismissRequest) {
                    Icon(Icons.Rounded.Close, contentDescription = "Cerrar", tint = CodeEvoTheme.extraColors.textSecondary)
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text("${log.action} • ${log.targetModule}", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                Text("Ejecutado por ${log.userName} (${log.userId})", style = MaterialTheme.typography.bodySmall, color = CodeEvoTheme.extraColors.textSecondary)

                HorizontalDivider(color = CodeEvoTheme.extraColors.border.copy(alpha = 0.4f))

                Text("Estado Anterior (Before Payload):", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textSecondary)
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = CodeEvoTheme.extraColors.danger.copy(alpha = 0.1f))
                ) {
                    Text(
                        text = log.payloadBefore ?: "{\n  \"status\": \"NEW_RECORD_NULL\"\n}",
                        style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                        color = CodeEvoTheme.extraColors.danger,
                        modifier = Modifier.padding(12.dp)
                    )
                }

                Text("Estado Posterior (After Payload):", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textSecondary)
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = CodeEvoTheme.extraColors.success.copy(alpha = 0.1f))
                ) {
                    Text(
                        text = log.payloadAfter ?: log.details,
                        style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                        color = CodeEvoTheme.extraColors.success,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }
        },
        confirmButton = {
            CodeEvoButton(text = "Cerrar", onClick = onDismissRequest)
        }
    )
}
