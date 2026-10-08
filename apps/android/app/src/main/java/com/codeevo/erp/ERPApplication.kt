package com.codeevo.erp

import android.app.Application
import com.codeevo.erp.data.local.TokenRepository
import com.codeevo.erp.data.network.ApiClient
import com.codeevo.erp.data.repository.AuditRepository
import com.codeevo.erp.data.repository.AuthRepository
import com.codeevo.erp.data.repository.DashboardRepository
import com.codeevo.erp.data.repository.ProductRepository
import com.codeevo.erp.data.repository.ReportRepository
import com.codeevo.erp.data.repository.SalesRepository
import com.codeevo.erp.data.repository.SettingsRepository
import com.codeevo.erp.data.repository.UserRepository
import com.codeevo.erp.ui.theme.ThemeManager

/** Contenedor de dependencias: un único ApiClient compartido por todos los repos. */
class ERPApplication : Application() {

    lateinit var tokenRepository: TokenRepository
        private set

    lateinit var authRepository: AuthRepository
        private set

    lateinit var themeManager: ThemeManager
        private set

    lateinit var dashboardRepository: DashboardRepository
        private set

    lateinit var productRepository: ProductRepository
        private set

    lateinit var salesRepository: SalesRepository
        private set

    lateinit var auditRepository: AuditRepository
        private set

    lateinit var userRepository: UserRepository
        private set

    lateinit var settingsRepository: SettingsRepository
        private set

    lateinit var reportRepository: ReportRepository
        private set

    override fun onCreate() {
        super.onCreate()
        tokenRepository = TokenRepository(this)
        val apiService = ApiClient.getApiService(tokenRepository)
        authRepository = AuthRepository(apiService, tokenRepository)
        themeManager = ThemeManager(this)

        dashboardRepository = DashboardRepository(apiService)
        productRepository = ProductRepository(apiService)
        salesRepository = SalesRepository(apiService)
        auditRepository = AuditRepository(apiService)
        userRepository = UserRepository(apiService)
        settingsRepository = SettingsRepository(apiService)
        reportRepository = ReportRepository(apiService)
    }
}
