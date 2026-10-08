package com.codeevo.erp.ui.screens.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.codeevo.erp.data.repository.ReportRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Etiqueta de categoría de la UI (datos derivados de /reports + /sales). */
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

    /**
     * Todos los importes provienen del backend (GET /reports/sales,
     * GET /reports/purchases, /sales y /products): sin cifras de ejemplo.
     */
    data class Content(
        val selectedPeriod: String = "Este Mes",
        val totalRevenue: Double = 0.0,
        val netMarginPercent: Double = 0.0,
        val totalExpenses: Double = 0.0,
        val inventoryTurnoverRate: Double = 0.0,
        val categoryBreakdown: List<ReportCategorySales> = emptyList(),
        val monthlyBars: List<MonthlyBarData> = emptyList()
    ) : ReportsUiState

    data class Error(val message: String) : ReportsUiState
}

class ReportsViewModel(
    private val reportRepository: ReportRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ReportsUiState>(ReportsUiState.Loading)
    val uiState: StateFlow<ReportsUiState> = _uiState.asStateFlow()

    private var selectedPeriod: String = "Este Mes"

    init {
        loadReportData()
    }

    fun loadReportData() {
        viewModelScope.launch {
            _uiState.value = ReportsUiState.Loading
            reportRepository.getReportData(selectedPeriod).fold(
                onSuccess = { data ->
                    _uiState.value = ReportsUiState.Content(
                        selectedPeriod = selectedPeriod,
                        totalRevenue = data.totalRevenue,
                        netMarginPercent = data.netMarginPercent,
                        totalExpenses = data.totalExpenses,
                        inventoryTurnoverRate = data.inventoryTurnoverRate,
                        categoryBreakdown = data.categories.map {
                            ReportCategorySales(it.category, it.amount, it.percentage)
                        },
                        monthlyBars = data.monthlyBars.map {
                            MonthlyBarData(it.month, it.sales, it.purchases)
                        }
                    )
                },
                onFailure = { e ->
                    _uiState.value = ReportsUiState.Error(e.message ?: "Error al cargar reportes")
                }
            )
        }
    }

    /** Cambia el periodo y recarga contra el backend (sin multiplicadores ficticios). */
    fun setPeriodFilter(period: String) {
        selectedPeriod = period
        loadReportData()
    }

    class Factory(private val reportRepository: ReportRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return ReportsViewModel(reportRepository) as T
        }
    }
}
