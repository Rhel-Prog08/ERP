package com.codeevo.erp.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// CodeEvo Brand Tokens (80% neutral + 15% blue + 5% cyan rule)
val CodeEvoBlue = Color(0xFF2563EB)
val CodeEvoCyan = Color(0xFF06B6D4)
val CodeEvoSuccess = Color(0xFF22C55E)
val CodeEvoWarning = Color(0xFFF59E0B)
val CodeEvoDanger = Color(0xFFEF4444)

// Dark Theme Palette
val DarkBackground = Color(0xFF080D18)
val DarkSurface = Color(0xFF0E1524)
val DarkSurface2 = Color(0xFF131C2D)
val DarkBorder = Color(0xFF253146)
val DarkTextPrimary = Color(0xFFF8FAFC)
val DarkTextSecondary = Color(0xFF94A3B8)

// Light Theme Palette
val LightBackground = Color(0xFFF5F7FA)
val LightSurface = Color(0xFFFFFFFF)
val LightSurface2 = Color(0xFFF8FAFC)
val LightBorder = Color(0xFFE2E8F0)
val LightTextPrimary = Color(0xFF0F172A)
val LightTextSecondary = Color(0xFF64748B)

@Immutable
data class CodeEvoExtraColors(
    val surface2: Color,
    val border: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val primaryBlue: Color,
    val cyan: Color,
    val success: Color,
    val warning: Color,
    val danger: Color
)

val LocalCodeEvoExtraColors = staticCompositionLocalOf {
    CodeEvoExtraColors(
        surface2 = DarkSurface2,
        border = DarkBorder,
        textPrimary = DarkTextPrimary,
        textSecondary = DarkTextSecondary,
        primaryBlue = CodeEvoBlue,
        cyan = CodeEvoCyan,
        success = CodeEvoSuccess,
        warning = CodeEvoWarning,
        danger = CodeEvoDanger
    )
}
