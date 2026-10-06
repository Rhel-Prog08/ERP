package com.example.erp.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.erp.data.repository.DashboardRepository
import com.example.erp.domain.model.AuditLog
import com.example.erp.domain.model.DashboardKpis
import com.example.erp.domain.model.Product
import com.example.erp.domain.model.Sale
import com.example.erp.domain.model.TopProduct
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface DashboardUiState {
    data object Loading : DashboardUiState
    data class Error(val message: String) : DashboardUiState
    data class Content(
        val kpis: DashboardKpis,
        val recentSales: List<Sale>,
        val lowStockProducts: List<Product>,
        val topProducts: List<TopProduct>,
        val recentAuditLogs: List<AuditLog>,
        val monthlyTargetRevenue: Double = 300000.00,
        val monthlyTargetCurrent: Double = 284500.00
    ) : DashboardUiState
}

class DashboardViewModel(
    private val repository: DashboardRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadDashboardData()
    }

    fun loadDashboardData() {
        viewModelScope.launch {
            _uiState.value = DashboardUiState.Loading
            try {
                val kpisRes = repository.getDashboardKpis()
                val salesRes = repository.getRecentSales()
                val lowStockRes = repository.getLowStockProducts()
                val topProductsRes = repository.getTopSellingProducts()
                val auditRes = repository.getAuditLogs()

                val kpis = kpisRes.getOrNull()
                val sales = salesRes.getOrDefault(emptyList())
                val lowStock = lowStockRes.getOrDefault(emptyList())
                val topProducts = topProductsRes.getOrDefault(emptyList())
                val auditLogs = auditRes.getOrDefault(emptyList())

                if (kpis != null) {
                    _uiState.value = DashboardUiState.Content(
                        kpis = kpis,
                        recentSales = sales,
                        lowStockProducts = lowStock,
                        topProducts = topProducts,
                        recentAuditLogs = auditLogs
                    )
                } else {
                    _uiState.value = DashboardUiState.Error("No se pudieron cargar los datos del dashboard. Compruebe la conexión.")
                }
            } catch (e: Exception) {
                _uiState.value = DashboardUiState.Error(e.message ?: "Ocurrió un error inesperado al cargar el dashboard.")
            }
        }
    }

    class Factory(private val repository: DashboardRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return DashboardViewModel(repository) as T
        }
    }
}
