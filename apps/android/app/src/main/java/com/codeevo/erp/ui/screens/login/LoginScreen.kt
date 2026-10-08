package com.codeevo.erp.ui.screens.login

import android.content.res.Configuration
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Login
import androidx.compose.material.icons.rounded.Business
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.codeevo.erp.ui.components.CodeEvoButton
import com.codeevo.erp.ui.components.CodeEvoTextField
import com.codeevo.erp.ui.theme.CodeEvoTheme
import com.codeevo.erp.ui.theme.ERPTheme

@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()

    LoginContent(
        uiState = uiState,
        onUsernameOrEmailChanged = viewModel::onUsernameOrEmailChanged,
        onPasswordChanged = viewModel::onPasswordChanged,
        onTogglePasswordVisibility = viewModel::togglePasswordVisibility,
        onRememberMeChanged = viewModel::onRememberMeChanged,
        onClearError = viewModel::clearError,
        onLogin = viewModel::login,
        modifier = modifier
    )
}

@Composable
fun LoginContent(
    uiState: LoginUiState,
    onUsernameOrEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
    onTogglePasswordVisibility: () -> Unit,
    onRememberMeChanged: (Boolean) -> Unit,
    onClearError: () -> Unit,
    onLogin: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 440.dp),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(
                    containerColor = CodeEvoTheme.extraColors.surface2
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Logo Badge
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(
                                brush = Brush.linearGradient(
                                    colors = listOf(
                                        CodeEvoTheme.extraColors.primaryBlue,
                                        CodeEvoTheme.extraColors.cyan
                                    )
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Business,
                            contentDescription = "CodeEvo Logo",
                            tint = Color.White,
                            modifier = Modifier.size(38.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "CodeEvo ERP",
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        ),
                        color = CodeEvoTheme.extraColors.textPrimary
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = "Sistema de Gestión Empresarial",
                        style = MaterialTheme.typography.bodyMedium,
                        color = CodeEvoTheme.extraColors.textSecondary
                    )

                    Spacer(modifier = Modifier.height(28.dp))

                    // Error Banner
                    AnimatedVisibility(
                        visible = uiState.errorMessage != null,
                        enter = fadeIn(),
                        exit = fadeOut()
                    ) {
                        if (uiState.errorMessage != null) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 20.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(CodeEvoTheme.extraColors.danger.copy(alpha = 0.12f))
                                    .border(
                                        width = 1.dp,
                                        color = CodeEvoTheme.extraColors.danger.copy(alpha = 0.5f),
                                        shape = RoundedCornerShape(12.dp)
                                    )
                                    .padding(12.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.ErrorOutline,
                                        contentDescription = "Error",
                                        tint = CodeEvoTheme.extraColors.danger,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = uiState.errorMessage,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = CodeEvoTheme.extraColors.danger,
                                        modifier = Modifier.weight(1f)
                                    )
                                    IconButton(
                                        onClick = onClearError,
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Rounded.Close,
                                            contentDescription = "Cerrar error",
                                            tint = CodeEvoTheme.extraColors.danger,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Username / Email Field
                    CodeEvoTextField(
                        value = uiState.usernameOrEmail,
                        onValueChange = onUsernameOrEmailChanged,
                        label = "Usuario o Correo",
                        placeholder = "admin@codeevo.com",
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Rounded.Person,
                                contentDescription = null,
                                tint = CodeEvoTheme.extraColors.textSecondary,
                                modifier = Modifier.size(20.dp)
                            )
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Password Field
                    CodeEvoTextField(
                        value = uiState.password,
                        onValueChange = onPasswordChanged,
                        label = "Contraseña",
                        placeholder = "••••••••",
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Rounded.Lock,
                                contentDescription = null,
                                tint = CodeEvoTheme.extraColors.textSecondary,
                                modifier = Modifier.size(20.dp)
                            )
                        },
                        trailingIcon = {
                            IconButton(onClick = onTogglePasswordVisibility) {
                                Icon(
                                    imageVector = if (uiState.isPasswordVisible) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                                    contentDescription = if (uiState.isPasswordVisible) "Ocultar contraseña" else "Mostrar contraseña",
                                    tint = CodeEvoTheme.extraColors.textSecondary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        },
                        visualTransformation = if (uiState.isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = { onLogin() }
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Remember Me Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Start
                    ) {
                        Checkbox(
                            checked = uiState.rememberMe,
                            onCheckedChange = onRememberMeChanged,
                            colors = CheckboxDefaults.colors(
                                checkedColor = CodeEvoTheme.extraColors.primaryBlue,
                                uncheckedColor = CodeEvoTheme.extraColors.textSecondary
                            )
                        )
                        Text(
                            text = "Recordarme en este dispositivo",
                            style = MaterialTheme.typography.bodyMedium,
                            color = CodeEvoTheme.extraColors.textPrimary
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Primary Login Button
                    CodeEvoButton(
                        text = "Iniciar Sesión",
                        onClick = onLogin,
                        isLoading = uiState.isLoading,
                        icon = Icons.AutoMirrored.Rounded.Login,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(28.dp))

                    // Enterprise Footer
                    Text(
                        text = "CodeEvo Systems © 2025 • v1.0.0",
                        style = MaterialTheme.typography.labelSmall,
                        color = CodeEvoTheme.extraColors.textSecondary.copy(alpha = 0.7f)
                    )
                }
            }
        }
    }
}

@Preview(name = "Login Screen Light", showBackground = true)
@Composable
fun LoginScreenLightPreview() {
    ERPTheme(darkTheme = false) {
        LoginContent(
            uiState = LoginUiState(usernameOrEmail = "admin@codeevo.com"),
            onUsernameOrEmailChanged = {},
            onPasswordChanged = {},
            onTogglePasswordVisibility = {},
            onRememberMeChanged = {},
            onClearError = {},
            onLogin = {}
        )
    }
}

@Preview(name = "Login Screen Dark", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
fun LoginScreenDarkPreview() {
    ERPTheme(darkTheme = true) {
        LoginContent(
            uiState = LoginUiState(usernameOrEmail = "admin@codeevo.com"),
            onUsernameOrEmailChanged = {},
            onPasswordChanged = {},
            onTogglePasswordVisibility = {},
            onRememberMeChanged = {},
            onClearError = {},
            onLogin = {}
        )
    }
}
