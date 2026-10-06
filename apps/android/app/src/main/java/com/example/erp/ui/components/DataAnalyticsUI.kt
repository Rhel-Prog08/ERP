package com.example.erp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowDownward
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.erp.ui.theme.CodeEvoTheme
import java.text.NumberFormat
import java.util.Locale

@Composable
fun CodeEvoMoneyDisplay(
    amount: Double,
    modifier: Modifier = Modifier,
    currencySymbol: String = "$",
    textStyle: TextStyle = MaterialTheme.typography.titleLarge,
    color: Color = CodeEvoTheme.extraColors.textPrimary
) {
    val formatter = NumberFormat.getNumberInstance(Locale.US).apply {
        minimumFractionDigits = 2
        maximumFractionDigits = 2
    }
    val formattedString = "$currencySymbol${formatter.format(amount)}"

    Text(
        text = formattedString,
        style = textStyle,
        color = color,
        modifier = modifier
    )
}

@Composable
fun CodeEvoStatCard(
    title: String,
    value: String,
    modifier: Modifier = Modifier,
    changePercent: Double? = null,
    trendText: String? = "vs last month",
    icon: ImageVector? = null,
    accentColor: Color = CodeEvoTheme.extraColors.primaryBlue
) {
    CodeEvoCard(
        modifier = modifier.fillMaxWidth(),
        contentPadding = 16.dp
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                    color = CodeEvoTheme.extraColors.textSecondary
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = value,
                    style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                    color = CodeEvoTheme.extraColors.textPrimary
                )
            }

            if (icon != null) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(accentColor.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = title,
                        tint = accentColor,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
        }

        if (changePercent != null) {
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                val isPositive = changePercent >= 0
                val trendColor = if (isPositive) CodeEvoTheme.extraColors.success else CodeEvoTheme.extraColors.danger
                val trendIcon = if (isPositive) Icons.Rounded.ArrowUpward else Icons.Rounded.ArrowDownward

                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(trendColor.copy(alpha = 0.15f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = trendIcon,
                            contentDescription = null,
                            tint = trendColor,
                            modifier = Modifier.size(12.dp)
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = "${if (isPositive) "+" else ""}${String.format(Locale.US, "%.1f", changePercent)}%",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = trendColor
                        )
                    }
                }

                if (!trendText.isNullOrBlank()) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = trendText,
                        style = MaterialTheme.typography.bodySmall,
                        color = CodeEvoTheme.extraColors.textSecondary
                    )
                }
            }
        }
    }
}
