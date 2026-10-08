package com.codeevo.erp.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.codeevo.erp.domain.model.DocumentStatus
import com.codeevo.erp.domain.model.InventoryStatus
import com.codeevo.erp.ui.theme.CodeEvoTheme

@Composable
fun CodeEvoCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    shape: Shape = RoundedCornerShape(16.dp),
    backgroundColor: Color = CodeEvoTheme.extraColors.surface2,
    borderColor: Color = CodeEvoTheme.extraColors.border,
    contentPadding: Dp = 16.dp,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier.then(
            if (onClick != null) Modifier.clickable { onClick() } else Modifier
        ),
        shape = shape,
        border = BorderStroke(1.dp, borderColor),
        colors = CardDefaults.cardColors(
            containerColor = backgroundColor
        )
    ) {
        Column(
            modifier = Modifier.padding(contentPadding),
            content = content
        )
    }
}

@Composable
fun CodeEvoBadge(
    text: String,
    modifier: Modifier = Modifier,
    backgroundColor: Color = CodeEvoTheme.extraColors.primaryBlue.copy(alpha = 0.15f),
    contentColor: Color = CodeEvoTheme.extraColors.primaryBlue,
    icon: ImageVector? = null
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(backgroundColor)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(12.dp),
                    tint = contentColor
                )
                Spacer(modifier = Modifier.width(4.dp))
            }
            Text(
                text = text,
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                color = contentColor
            )
        }
    }
}

@Composable
fun CodeEvoStatusBadge(
    inventoryStatus: InventoryStatus? = null,
    documentStatus: DocumentStatus? = null,
    customLabel: String? = null,
    modifier: Modifier = Modifier
) {
    val (label, bg, fg) = when {
        inventoryStatus != null -> when (inventoryStatus) {
            InventoryStatus.NORMAL -> Triple("Normal", CodeEvoTheme.extraColors.success.copy(alpha = 0.15f), CodeEvoTheme.extraColors.success)
            InventoryStatus.LOW -> Triple("Low Stock", CodeEvoTheme.extraColors.warning.copy(alpha = 0.15f), CodeEvoTheme.extraColors.warning)
            InventoryStatus.OUT_OF_STOCK -> Triple("Out of Stock", CodeEvoTheme.extraColors.danger.copy(alpha = 0.15f), CodeEvoTheme.extraColors.danger)
        }
        documentStatus != null -> when (documentStatus) {
            DocumentStatus.DRAFT -> Triple("Draft", CodeEvoTheme.extraColors.textSecondary.copy(alpha = 0.15f), CodeEvoTheme.extraColors.textSecondary)
            DocumentStatus.CONFIRMED -> Triple("Confirmed", CodeEvoTheme.extraColors.cyan.copy(alpha = 0.15f), CodeEvoTheme.extraColors.cyan)
            DocumentStatus.COMPLETED -> Triple("Completed", CodeEvoTheme.extraColors.success.copy(alpha = 0.15f), CodeEvoTheme.extraColors.success)
            DocumentStatus.CANCELLED -> Triple("Cancelled", CodeEvoTheme.extraColors.danger.copy(alpha = 0.15f), CodeEvoTheme.extraColors.danger)
        }
        else -> Triple(
            customLabel ?: "Active",
            CodeEvoTheme.extraColors.primaryBlue.copy(alpha = 0.15f),
            CodeEvoTheme.extraColors.primaryBlue
        )
    }

    CodeEvoBadge(
        text = label,
        modifier = modifier,
        backgroundColor = bg,
        contentColor = fg
    )
}
