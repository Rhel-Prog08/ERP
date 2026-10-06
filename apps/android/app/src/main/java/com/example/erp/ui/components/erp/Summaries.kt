package com.example.erp.ui.components.erp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.erp.domain.model.DocumentStatus
import com.example.erp.domain.model.Purchase
import com.example.erp.domain.model.Sale
import com.example.erp.ui.components.CodeEvoCard
import com.example.erp.ui.components.CodeEvoMoneyDisplay
import com.example.erp.ui.components.CodeEvoStatusBadge
import com.example.erp.ui.theme.CodeEvoTheme

@Composable
fun SaleSummary(
    sale: Sale,
    modifier: Modifier = Modifier,
    taxRate: Double = 0.16
) {
    val subtotal = sale.items.sumOf { it.subtotal }
    val taxAmount = subtotal * taxRate

    CodeEvoCard(
        modifier = modifier.fillMaxWidth(),
        contentPadding = 16.dp
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Venta ${sale.saleNumber}",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = CodeEvoTheme.extraColors.textPrimary
                )
                Text(
                    text = "Cliente: ${sale.customerName}",
                    style = MaterialTheme.typography.bodySmall,
                    color = CodeEvoTheme.extraColors.textSecondary
                )
            }
            CodeEvoStatusBadge(documentStatus = sale.status)
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(color = CodeEvoTheme.extraColors.border.copy(alpha = 0.4f))
        Spacer(modifier = Modifier.height(12.dp))

        // Itemized list
        Text(
            text = "Detalle de Artículos",
            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
            color = CodeEvoTheme.extraColors.textSecondary
        )
        Spacer(modifier = Modifier.height(8.dp))

        sale.items.forEach { item ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = item.productName,
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    Text(
                        text = "${item.quantity} x $${item.unitPrice}",
                        style = MaterialTheme.typography.labelSmall,
                        color = CodeEvoTheme.extraColors.textSecondary
                    )
                }
                CodeEvoMoneyDisplay(
                    amount = item.subtotal,
                    textStyle = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = CodeEvoTheme.extraColors.textPrimary
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        HorizontalDivider(color = CodeEvoTheme.extraColors.border.copy(alpha = 0.4f))
        Spacer(modifier = Modifier.height(12.dp))

        // Subtotal, Tax, Total
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Subtotal",
                style = MaterialTheme.typography.bodyMedium,
                color = CodeEvoTheme.extraColors.textSecondary
            )
            CodeEvoMoneyDisplay(
                amount = subtotal,
                textStyle = MaterialTheme.typography.bodyMedium,
                color = CodeEvoTheme.extraColors.textPrimary
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "IVA (${(taxRate * 100).toInt()}%)",
                style = MaterialTheme.typography.bodyMedium,
                color = CodeEvoTheme.extraColors.textSecondary
            )
            CodeEvoMoneyDisplay(
                amount = taxAmount,
                textStyle = MaterialTheme.typography.bodyMedium,
                color = CodeEvoTheme.extraColors.textPrimary
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Total General",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = CodeEvoTheme.extraColors.textPrimary
            )
            CodeEvoMoneyDisplay(
                amount = sale.totalAmount,
                textStyle = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = CodeEvoTheme.extraColors.cyan
            )
        }

        if (sale.status == DocumentStatus.COMPLETED || sale.status == DocumentStatus.CONFIRMED) {
            Spacer(modifier = Modifier.height(16.dp))
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = CodeEvoTheme.extraColors.success.copy(alpha = 0.15f)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Rounded.CheckCircle,
                        contentDescription = null,
                        tint = CodeEvoTheme.extraColors.success
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Venta procesada y comprobante fiscal registrado.",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium),
                        color = CodeEvoTheme.extraColors.success
                    )
                }
            }
        }
    }
}

@Composable
fun PurchaseSummary(
    purchase: Purchase,
    modifier: Modifier = Modifier,
    taxRate: Double = 0.16
) {
    val subtotal = purchase.items.sumOf { it.subtotal }
    val taxAmount = subtotal * taxRate

    CodeEvoCard(
        modifier = modifier.fillMaxWidth(),
        contentPadding = 16.dp
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Orden de Compra ${purchase.purchaseNumber}",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = CodeEvoTheme.extraColors.textPrimary
                )
                Text(
                    text = "Proveedor: ${purchase.supplierName}",
                    style = MaterialTheme.typography.bodySmall,
                    color = CodeEvoTheme.extraColors.textSecondary
                )
            }
            CodeEvoStatusBadge(documentStatus = purchase.status)
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(color = CodeEvoTheme.extraColors.border.copy(alpha = 0.4f))
        Spacer(modifier = Modifier.height(12.dp))

        // Itemized list
        Text(
            text = "Detalle de Insumos / Artículos",
            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
            color = CodeEvoTheme.extraColors.textSecondary
        )
        Spacer(modifier = Modifier.height(8.dp))

        purchase.items.forEach { item ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = item.productName,
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )
                    Text(
                        text = "${item.quantity} x $${item.unitPrice}",
                        style = MaterialTheme.typography.labelSmall,
                        color = CodeEvoTheme.extraColors.textSecondary
                    )
                }
                CodeEvoMoneyDisplay(
                    amount = item.subtotal,
                    textStyle = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = CodeEvoTheme.extraColors.textPrimary
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        HorizontalDivider(color = CodeEvoTheme.extraColors.border.copy(alpha = 0.4f))
        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Subtotal",
                style = MaterialTheme.typography.bodyMedium,
                color = CodeEvoTheme.extraColors.textSecondary
            )
            CodeEvoMoneyDisplay(
                amount = subtotal,
                textStyle = MaterialTheme.typography.bodyMedium,
                color = CodeEvoTheme.extraColors.textPrimary
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "IVA (${(taxRate * 100).toInt()}%)",
                style = MaterialTheme.typography.bodyMedium,
                color = CodeEvoTheme.extraColors.textSecondary
            )
            CodeEvoMoneyDisplay(
                amount = taxAmount,
                textStyle = MaterialTheme.typography.bodyMedium,
                color = CodeEvoTheme.extraColors.textPrimary
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Total Orden",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = CodeEvoTheme.extraColors.textPrimary
            )
            CodeEvoMoneyDisplay(
                amount = purchase.totalAmount,
                textStyle = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = CodeEvoTheme.extraColors.primaryBlue
            )
        }
    }
}
