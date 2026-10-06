package com.example.erp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Analytics
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.erp.domain.model.DocumentStatus
import com.example.erp.domain.model.InventoryStatus
import com.example.erp.ui.theme.CodeEvoTheme
import com.example.erp.ui.theme.ERPTheme
import com.example.erp.ui.theme.ThemeMode

@Composable
@Preview(name = "CodeEvo Components Dark Theme", showBackground = true)
fun CodeEvoComponentsDarkPreview() {
    ERPTheme(themeMode = ThemeMode.DARK) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(CodeEvoTheme.extraColors.surface2)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            CodeEvoStatCard(
                title = "Total Revenue",
                value = "$284,500.00",
                changePercent = 14.2,
                icon = Icons.Rounded.Analytics
            )

            CodeEvoMoneyDisplay(amount = 142500.00)

            CodeEvoButton(
                text = "Create New Invoice",
                onClick = {},
                icon = Icons.Rounded.Add,
                modifier = Modifier.fillMaxWidth()
            )

            CodeEvoSecondaryButton(
                text = "Export Report",
                onClick = {},
                modifier = Modifier.fillMaxWidth()
            )

            CodeEvoDestructiveButton(
                text = "Delete Order",
                onClick = {},
                icon = Icons.Rounded.Delete,
                modifier = Modifier.fillMaxWidth()
            )

            var searchText by remember { mutableStateOf("") }
            CodeEvoSearchField(
                value = searchText,
                onValueChange = { searchText = it }
            )

            CodeEvoStatusBadge(inventoryStatus = InventoryStatus.NORMAL)
            CodeEvoStatusBadge(inventoryStatus = InventoryStatus.LOW)
            CodeEvoStatusBadge(inventoryStatus = InventoryStatus.OUT_OF_STOCK)

            CodeEvoStatusBadge(documentStatus = DocumentStatus.DRAFT)
            CodeEvoStatusBadge(documentStatus = DocumentStatus.CONFIRMED)
            CodeEvoStatusBadge(documentStatus = DocumentStatus.COMPLETED)
            CodeEvoStatusBadge(documentStatus = DocumentStatus.CANCELLED)
        }
    }
}
