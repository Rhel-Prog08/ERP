package com.codeevo.erp.ui.screens.purchases

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.codeevo.erp.data.repository.ProductRepository
import com.codeevo.erp.data.repository.SalesRepository
import com.codeevo.erp.domain.model.DocumentStatus
import com.codeevo.erp.domain.model.Product
import com.codeevo.erp.domain.model.Purchase
import com.codeevo.erp.domain.model.Supplier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface PurchasesUiState {
    data object Loading : PurchasesUiState
    data class Content(
        val purchases: List<Purchase>,
        val filteredPurchases: List<Purchase>,
        val suppliers: List<Supplier>,
        val products: List<Product>,
        val searchQuery: String = "",
        val selectedStatus: String = "Todas"
    ) : PurchasesUiState
    data class Error(val message: String) : PurchasesUiState
}

class PurchasesViewModel(
    private val salesRepository: SalesRepository,
    private val productRepository: ProductRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<PurchasesUiState>(PurchasesUiState.Loading)
    val uiState: StateFlow<PurchasesUiState> = _uiState.asStateFlow()

    init {
        loadPurchasesData()
    }

    fun loadPurchasesData() {
        viewModelScope.launch {
            _uiState.value = PurchasesUiState.Loading
            try {
                val purRes = salesRepository.getPurchases()
                val suppRes = salesRepository.getSuppliers()
                val prodRes = productRepository.getProducts()

                val purchases = purRes.getOrDefault(emptyList())
                val suppliers = suppRes.getOrDefault(emptyList())
                val products = prodRes.getOrDefault(emptyList())

                val state = PurchasesUiState.Content(
                    purchases = purchases,
                    filteredPurchases = purchases,
                    suppliers = suppliers,
                    products = products
                )
                _uiState.value = filterPurchases(state)
            } catch (e: Exception) {
                _uiState.value = PurchasesUiState.Error(e.message ?: "Error al cargar módulo de compras")
            }
        }
    }

    fun setSearchQuery(query: String) {
        val current = _uiState.value as? PurchasesUiState.Content ?: return
        _uiState.value = filterPurchases(current.copy(searchQuery = query))
    }

    fun setStatusFilter(status: String) {
        val current = _uiState.value as? PurchasesUiState.Content ?: return
        _uiState.value = filterPurchases(current.copy(selectedStatus = status))
    }

    fun createPurchase(purchase: Purchase) {
        viewModelScope.launch {
            salesRepository.createPurchase(purchase)
            loadPurchasesData()
        }
    }

    fun receiveInventory(purchase: Purchase) {
        viewModelScope.launch {
            // RECIBIR en el backend (purchases.receive) YA crea los movimientos
            // de entrada de inventario en transacción: registrarlos otra vez
            // aquí duplicaría el stock.
            salesRepository.updatePurchaseStatus(purchase.id, DocumentStatus.COMPLETED)
            loadPurchasesData()
        }
    }

    private fun filterPurchases(state: PurchasesUiState.Content): PurchasesUiState.Content {
        val filtered = state.purchases.filter { purchase ->
            val matchesQuery = state.searchQuery.isBlank() ||
                    purchase.purchaseNumber.contains(state.searchQuery, ignoreCase = true) ||
                    purchase.supplierName.contains(state.searchQuery, ignoreCase = true)

            val matchesStatus = when (state.selectedStatus.uppercase()) {
                "BORRADOR" -> purchase.status == DocumentStatus.DRAFT
                "CONFIRMADA" -> purchase.status == DocumentStatus.CONFIRMED
                "COMPLETADA" -> purchase.status == DocumentStatus.COMPLETED
                "CANCELADA" -> purchase.status == DocumentStatus.CANCELLED
                else -> true
            }

            matchesQuery && matchesStatus
        }
        return state.copy(filteredPurchases = filtered)
    }

    class Factory(
        private val salesRepository: SalesRepository,
        private val productRepository: ProductRepository
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return PurchasesViewModel(salesRepository, productRepository) as T
        }
    }
}
