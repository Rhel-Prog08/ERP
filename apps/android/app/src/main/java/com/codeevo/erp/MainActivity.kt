package com.codeevo.erp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.codeevo.erp.ui.appshell.AppShell
import com.codeevo.erp.ui.screens.login.LoginScreen
import com.codeevo.erp.ui.screens.login.LoginViewModel
import com.codeevo.erp.ui.theme.ERPTheme
import com.codeevo.erp.ui.theme.ThemeMode

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as ERPApplication
        val authRepository = app.authRepository
        val themeManager = app.themeManager

        setContent {
            val themeMode by themeManager.themeMode.collectAsState(initial = ThemeMode.SYSTEM)
            val currentUser by authRepository.currentUser.collectAsState(initial = null)
            val isLoggedIn by authRepository.isLoggedIn.collectAsState(initial = false)

            ERPTheme(themeMode = themeMode) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    if (isLoggedIn && currentUser != null) {
                        AppShell(
                            user = currentUser!!,
                            authRepository = authRepository,
                            themeManager = themeManager
                        )
                    } else {
                        val loginViewModel: LoginViewModel = viewModel(
                            factory = LoginViewModel.Factory(authRepository)
                        )
                        LoginScreen(viewModel = loginViewModel)
                    }
                }
            }
        }
    }
}
