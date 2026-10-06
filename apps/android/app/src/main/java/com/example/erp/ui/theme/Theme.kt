package com.example.erp.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = CodeEvoBlue,
    onPrimary = Color.White,
    primaryContainer = DarkSurface2,
    onPrimaryContainer = DarkTextPrimary,
    secondary = CodeEvoCyan,
    onSecondary = Color.White,
    secondaryContainer = DarkSurface2,
    onSecondaryContainer = CodeEvoCyan,
    tertiary = CodeEvoCyan,
    background = DarkBackground,
    onBackground = DarkTextPrimary,
    surface = DarkSurface,
    onSurface = DarkTextPrimary,
    surfaceVariant = DarkSurface2,
    onSurfaceVariant = DarkTextSecondary,
    outline = DarkBorder,
    outlineVariant = DarkBorder,
    error = CodeEvoDanger,
    onError = Color.White
)

private val LightColorScheme = lightColorScheme(
    primary = CodeEvoBlue,
    onPrimary = Color.White,
    primaryContainer = LightSurface2,
    onPrimaryContainer = LightTextPrimary,
    secondary = CodeEvoCyan,
    onSecondary = Color.White,
    secondaryContainer = LightSurface2,
    onSecondaryContainer = CodeEvoCyan,
    tertiary = CodeEvoCyan,
    background = LightBackground,
    onBackground = LightTextPrimary,
    surface = LightSurface,
    onSurface = LightTextPrimary,
    surfaceVariant = LightSurface2,
    onSurfaceVariant = LightTextSecondary,
    outline = LightBorder,
    outlineVariant = LightBorder,
    error = CodeEvoDanger,
    onError = Color.White
)

private val DarkExtraColors = CodeEvoExtraColors(
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

private val LightExtraColors = CodeEvoExtraColors(
    surface2 = LightSurface2,
    border = LightBorder,
    textPrimary = LightTextPrimary,
    textSecondary = LightTextSecondary,
    primaryBlue = CodeEvoBlue,
    cyan = CodeEvoCyan,
    success = CodeEvoSuccess,
    warning = CodeEvoWarning,
    danger = CodeEvoDanger
)

object CodeEvoTheme {
    val extraColors: CodeEvoExtraColors
        @Composable
        @ReadOnlyComposable
        get() = LocalCodeEvoExtraColors.current
}

@Composable
fun ERPTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    darkTheme: Boolean = when (themeMode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
    },
    useDynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        useDynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val extraColors = if (darkTheme) DarkExtraColors else LightExtraColors

    val view = LocalView.current
    if (!view.isInEditMode) {
        val window = (view.context as? Activity)?.window
        if (window != null) {
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    CompositionLocalProvider(
        LocalCodeEvoExtraColors provides extraColors
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = Typography,
            content = content
        )
    }
}
