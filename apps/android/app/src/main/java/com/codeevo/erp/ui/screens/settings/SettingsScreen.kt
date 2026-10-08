package com.codeevo.erp.ui.screens.settings

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Business
import androidx.compose.material.icons.rounded.Save
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
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
import com.codeevo.erp.domain.model.User
import com.codeevo.erp.ui.components.CodeEvoButton
import com.codeevo.erp.ui.components.CodeEvoCard
import com.codeevo.erp.ui.components.CodeEvoSecondaryButton
import com.codeevo.erp.ui.components.CodeEvoTextField
import com.codeevo.erp.ui.theme.CodeEvoTheme

/**
 * Configuración de la empresa con datos REALES:
 * GET/PATCH /companies (razón social, RFC, dirección, teléfono) y
 * GET/PATCH /settings (tasa de IVA). Sin valores de ejemplo fijos.
 */
@Composable
fun SettingsScreen(
    user: User?
) {
    val app = LocalContext.current.applicationContext as ERPApplication
    val viewModel: SettingsViewModel = viewModel(
        factory = SettingsViewModel.Factory(app.settingsRepository)
    )
    val state by viewModel.uiState.collectAsState()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when (val uiState = state) {
            is SettingsUiState.Loading -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        "Cargando configuración…",
                        style = MaterialTheme.typography.bodyMedium,
                        color = CodeEvoTheme.extraColors.textSecondary
                    )
                }
            }

            is SettingsUiState.Error -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        uiState.message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = CodeEvoTheme.extraColors.danger
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    CodeEvoSecondaryButton(text = "Reintentar", onClick = { viewModel.loadSettings() })
                }
            }

            is SettingsUiState.Content -> SettingsContent(
                content = uiState,
                onSave = { companyName, legalName, taxId, address, phone, taxRate ->
                    viewModel.save(companyName, legalName, taxId, address, phone, taxRate)
                }
            )
        }
    }
}

@Composable
private fun SettingsContent(
    content: SettingsUiState.Content,
    onSave: (String, String, String, String, String, Double) -> Unit
) {
    // Los campos se realinean cuando llegan datos nuevos del servidor.
    var companyName by remember(content.companyId, content.saved) { mutableStateOf(content.companyName) }
    var taxId by remember(content.companyId, content.saved) { mutableStateOf(content.taxId) }
    var address by remember(content.companyId, content.saved) { mutableStateOf(content.address) }
    var phone by remember(content.companyId, content.saved) { mutableStateOf(content.phone) }
    var legalName by remember(content.companyId, content.saved) { mutableStateOf(content.legalName) }
    var taxRateText by remember(content.companyId, content.saved) { mutableStateOf(content.taxRatePercent.toString()) }

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
                        Icon(Icons.Rounded.Settings, contentDescription = null, tint = CodeEvoTheme.extraColors.primaryBlue)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Empresa y Configuración", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                    }
                    Text(
                        "Datos fiscales de ${content.companyName.ifBlank { "tu empresa" }} (GET/PATCH /companies) y parámetros fiscales (/settings)",
                        style = MaterialTheme.typography.bodyMedium,
                        color = CodeEvoTheme.extraColors.textSecondary
                    )
                }

                CodeEvoButton(
                    text = "Guardar Cambios",
                    onClick = {
                        val rate = taxRateText.toDoubleOrNull() ?: content.taxRatePercent
                        onSave(companyName, legalName, taxId, address, phone, rate)
                    },
                    icon = Icons.Rounded.Save
                )
            }
        }

        if (content.saved && content.message != null) {
            item {
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = CodeEvoTheme.extraColors.success.copy(alpha = 0.15f))
                ) {
                    Text(
                        text = "¡${content.message}!",
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.success,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
        }

        if (!content.saved && content.message != null) {
            item {
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = CodeEvoTheme.extraColors.danger.copy(alpha = 0.15f))
                ) {
                    Text(
                        text = content.message,
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                        color = CodeEvoTheme.extraColors.danger,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
        }

        item {
            CodeEvoCard(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = 20.dp
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Business, contentDescription = null, tint = CodeEvoTheme.extraColors.primaryBlue)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Perfil Fiscal y Comercial", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = CodeEvoTheme.extraColors.textPrimary)
                }

                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = CodeEvoTheme.extraColors.border.copy(alpha = 0.4f))
                Spacer(modifier = Modifier.height(16.dp))

                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    CodeEvoTextField(value = companyName, onValueChange = { companyName = it }, label = "Razón Social / Nombre Comercial", placeholder = "CodeEvo Inc.")
                    CodeEvoTextField(value = legalName, onValueChange = { legalName = it }, label = "Razón Social Legal", placeholder = "CodeEvo Inc. S.A. de C.V.")
                    CodeEvoTextField(value = taxId, onValueChange = { taxId = it }, label = "Identificación Fiscal (RFC / RUC / NIT)", placeholder = "RFC123456789")
                    CodeEvoTextField(value = address, onValueChange = { address = it }, label = "Dirección Matriz", placeholder = "Calle Principal 123", singleLine = false)
                    CodeEvoTextField(value = phone, onValueChange = { phone = it }, label = "Teléfono Conmutador", placeholder = "+1 800-000-0000")
                    CodeEvoTextField(value = taxRateText, onValueChange = { taxRateText = it }, label = "Tasa de IVA Default (%)", placeholder = "21")
                }
            }
        }
    }
}
