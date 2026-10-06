package com.example.erp.ui.screens.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.erp.data.repository.DashboardRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ReportCategorySales(
    val category: String,
    val amount: Double,
    val percentage: Float
)

data class MonthlyBarData(
    val month: String,
    val sales: Double,
    val purchases: Double
)

sealed interface ReportsUiState {
    data object Loading : ReportsUiState
    data class Content(
        val selectedPeriod: String = "Este Mes",
        val totalRevenue: Double = 284500.00,
        val netMarginPercent: Double = 32.4,
        val totalExpenses: Double = 142000.00,
        val inventoryTurnoverRate: Double = 4.2,
        val categoryBreakdown: List<ReportCategorySales>,
        val monthlyBars: List<MonthlyBarData>
    ) : ReportsUiState
    data class Error(val message: String) : ReportsUiState
}

class ReportsViewModel(
    private val dashboardRepository: DashboardRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ReportsUiState>(ReportsUiState.Loading)
    val uiState: StateFlow<ReportsUiState> = _uiState.asStateFlow()

    init {
        loadReportData()
    }

    fun loadReportData() {
        viewModelScope.launch {
            _uiState.value = ReportsUiState.Loading
            try {
                val state = ReportsUiState.Content(
                    categoryBreakdown = listOf(
                        ReportCategorySales("Hardware", 125000.0, 0.44f),
                        ReportCategorySales("Software", 85000.0, 0.30f),
                        ReportCategorySales("Networking", 54000.0, 0.19f),
                        ReportCategorySales("Peripherals", 20500.0, 0.07f)
                    ),
                    monthlyBars = listOf(
                        MonthlyBarData("Ene", 180000.0, 110000.0),
                        MonthlyBarData("Feb", 210000.0, 125000.0),
                        MonthlyBarData("Mar", 240000.0, 130000.0),
                        MonthlyBarData("Abr", 284500.0, 142000.0)
                    )
                )
                _uiState.value = state
            } catch (e: Exception) {
                _uiState.value = ReportsUiState.Error(e.message ?: "Error al cargar reportes")
            }
        }
    }

    fun setPeriodFilter(period: String) {
        val current = _uiState.value as? ReportsUiState.Content ?: return
        val multiplier = when (period) {
            "Hoy" -> 0.05
            "Esta Semana" -> 0.25
            "Año Actual" -> 4.5
            else -> 1.0
        }
        _uiState.value = current.copy(
            selectedPeriod = period,
            totalRevenue = 284500.00 * multiplier,
            totalExpenses = 142000.00 * multiplier
        )
    }

    class Factory(private val dashboardRepository: DashboardRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return ReportsViewModel(dashboardRepository) as T
        }
    }
}
