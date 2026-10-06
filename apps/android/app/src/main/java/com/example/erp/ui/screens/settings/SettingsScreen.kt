package com.example.erp.ui.screens.settings

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.erp.domain.model.User
import com.example.erp.ui.components.CodeEvoButton
import com.example.erp.ui.components.CodeEvoCard
import com.example.erp.ui.components.CodeEvoTextField
import com.example.erp.ui.theme.CodeEvoTheme

@Composable
fun SettingsScreen(
    user: User?
) {
    var companyName by remember { mutableStateOf("CodeEvo Systems S.A. de C.V.") }
    var taxId by remember { mutableStateOf("CES20250809XYZ") }
    var address by remember { mutableStateOf("Av. Tecnológico 1000, Silicon Valley, CA") }
    var phone by remember { mutableStateOf("+1 800-555-0199") }
    var currency by remember { mutableStateOf("USD ($)") }
    var taxRateText by remember { mutableStateOf("16") }
    var savedSuccess by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
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
                        Text("Ajustes generales de CodeEvo Systems, parámetros fiscales y datos de contacto", style = MaterialTheme.typography.bodyMedium, color = CodeEvoTheme.extraColors.textSecondary)
                    }

                    CodeEvoButton(
                        text = "Guardar Cambios",
                        onClick = { savedSuccess = true },
                        icon = Icons.Rounded.Save
                    )
                }
            }

            if (savedSuccess) {
                item {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = CodeEvoTheme.extraColors.success.copy(alpha = 0.15f))
                    ) {
                        Text(
                            text = "¡Ajustes de empresa guardados exitosamente!",
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                            color = CodeEvoTheme.extraColors.success,
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
                        CodeEvoTextField(value = taxId, onValueChange = { taxId = it }, label = "Identificación Fiscal (RFC / RUC / NIT)", placeholder = "RFC123456789")
                        CodeEvoTextField(value = address, onValueChange = { address = it }, label = "Dirección Matriz", placeholder = "Calle Principal 123", singleLine = false)
                        CodeEvoTextField(value = phone, onValueChange = { phone = it }, label = "Teléfono Conmutador", placeholder = "+1 800-000-0000")

                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            CodeEvoTextField(value = currency, onValueChange = { currency = it }, label = "Moneda Base", placeholder = "USD ($)", modifier = Modifier.weight(1f))
                            CodeEvoTextField(value = taxRateText, onValueChange = { taxRateText = it }, label = "Tasa de IVA Default (%)", placeholder = "16", modifier = Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}
