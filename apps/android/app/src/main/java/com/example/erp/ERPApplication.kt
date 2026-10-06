package com.example.erp

import android.app.Application
import com.example.erp.data.local.TokenRepository
import com.example.erp.data.network.ApiClient
import com.example.erp.data.repository.AuditRepository
import com.example.erp.data.repository.AuthRepository
import com.example.erp.data.repository.DashboardRepository
import com.example.erp.data.repository.ProductRepository
import com.example.erp.data.repository.SalesRepository
import com.example.erp.data.repository.UserRepository
import com.example.erp.ui.theme.ThemeManager

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
    }
}
