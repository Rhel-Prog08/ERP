package com.codeevo.erp.ui.screens.sales

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.codeevo.erp.data.repository.ProductRepository
import com.codeevo.erp.data.repository.SalesRepository
import com.codeevo.erp.domain.model.Customer
import com.codeevo.erp.domain.model.DocumentStatus
import com.codeevo.erp.domain.model.Product
import com.codeevo.erp.domain.model.Sale
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface SalesUiState {
    data object Loading : SalesUiState
    data class Content(
        val sales: List<Sale>,
        val filteredSales: List<Sale>,
        val customers: List<Customer>,
        val products: List<Product>,
        val searchQuery: String = "",
        val selectedStatus: String = "Todas"
    ) : SalesUiState
    data class Error(val message: String) : SalesUiState
}

class SalesViewModel(
    private val salesRepository: SalesRepository,
    private val productRepository: ProductRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<SalesUiState>(SalesUiState.Loading)
    val uiState: StateFlow<SalesUiState> = _uiState.asStateFlow()

    init {
        loadSalesData()
    }

    fun loadSalesData() {
        viewModelScope.launch {
            _uiState.value = SalesUiState.Loading
            try {
                val salesRes = salesRepository.getSales()
                val custRes = salesRepository.getCustomers()
                val prodRes = productRepository.getProducts()

                val sales = salesRes.getOrDefault(emptyList())
                val customers = custRes.getOrDefault(emptyList())
                val products = prodRes.getOrDefault(emptyList())

                val state = SalesUiState.Content(
                    sales = sales,
                    filteredSales = sales,
                    customers = customers,
                    products = products
                )
                _uiState.value = filterSales(state)
            } catch (e: Exception) {
                _uiState.value = SalesUiState.Error(e.message ?: "Error al cargar módulo de ventas")
            }
        }
    }

    fun setSearchQuery(query: String) {
        val current = _uiState.value as? SalesUiState.Content ?: return
        _uiState.value = filterSales(current.copy(searchQuery = query))
    }

    fun setStatusFilter(status: String) {
        val current = _uiState.value as? SalesUiState.Content ?: return
        _uiState.value = filterSales(current.copy(selectedStatus = status))
    }

    fun createSale(sale: Sale) {
        viewModelScope.launch {
            salesRepository.createSale(sale)
            loadSalesData()
        }
    }

    fun updateSaleStatus(saleId: String, status: DocumentStatus) {
        viewModelScope.launch {
            salesRepository.updateSaleStatus(saleId, status)
            loadSalesData()
        }
    }

    private fun filterSales(state: SalesUiState.Content): SalesUiState.Content {
        val filtered = state.sales.filter { sale ->
            val matchesQuery = state.searchQuery.isBlank() ||
                    sale.saleNumber.contains(state.searchQuery, ignoreCase = true) ||
                    sale.customerName.contains(state.searchQuery, ignoreCase = true)

            val matchesStatus = when (state.selectedStatus.uppercase()) {
                "BORRADOR" -> sale.status == DocumentStatus.DRAFT
                "CONFIRMADA" -> sale.status == DocumentStatus.CONFIRMED
                "COMPLETADA" -> sale.status == DocumentStatus.COMPLETED
                "CANCELADA" -> sale.status == DocumentStatus.CANCELLED
                else -> true
            }

            matchesQuery && matchesStatus
        }
        return state.copy(filteredSales = filtered)
    }

    class Factory(
        private val salesRepository: SalesRepository,
        private val productRepository: ProductRepository
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return SalesViewModel(salesRepository, productRepository) as T
        }
    }
}
