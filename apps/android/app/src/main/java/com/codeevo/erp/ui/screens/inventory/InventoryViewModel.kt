package com.codeevo.erp.ui.screens.inventory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.codeevo.erp.data.repository.InventoryMovement
import com.codeevo.erp.data.repository.ProductRepository
import com.codeevo.erp.domain.model.InventoryItem
import com.codeevo.erp.domain.model.Product
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface InventoryUiState {
    data object Loading : InventoryUiState
    data class Content(
        val inventoryItems: List<InventoryItem>,
        val filteredItems: List<InventoryItem>,
        val movements: List<InventoryMovement>,
        val products: List<Product>,
        val searchQuery: String = "",
        val selectedTab: Int = 0 // 0: Stock Levels, 1: Movement History
    ) : InventoryUiState
    data class Error(val message: String) : InventoryUiState
}

class InventoryViewModel(
    private val productRepository: ProductRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<InventoryUiState>(InventoryUiState.Loading)
    val uiState: StateFlow<InventoryUiState> = _uiState.asStateFlow()

    init {
        loadInventory()
    }

    fun loadInventory() {
        viewModelScope.launch {
            _uiState.value = InventoryUiState.Loading
            try {
                val invRes = productRepository.getInventoryItems()
                val movRes = productRepository.getInventoryMovements()
                val prodRes = productRepository.getProducts()

                val items = invRes.getOrDefault(emptyList())
                val movements = movRes.getOrDefault(emptyList())
                val products = prodRes.getOrDefault(emptyList())

                val state = InventoryUiState.Content(
                    inventoryItems = items,
                    filteredItems = items,
                    movements = movements,
                    products = products
                )
                _uiState.value = filterInventory(state)
            } catch (e: Exception) {
                _uiState.value = InventoryUiState.Error(e.message ?: "Error al cargar inventario")
            }
        }
    }

    fun setSearchQuery(query: String) {
        val current = _uiState.value as? InventoryUiState.Content ?: return
        _uiState.value = filterInventory(current.copy(searchQuery = query))
    }

    fun setSelectedTab(tabIndex: Int) {
        val current = _uiState.value as? InventoryUiState.Content ?: return
        _uiState.value = current.copy(selectedTab = tabIndex)
    }

    fun recordMovement(productId: String, type: String, quantity: Int, reason: String) {
        viewModelScope.launch {
            productRepository.recordMovement(productId, type, quantity, reason)
            loadInventory()
        }
    }

    private fun filterInventory(state: InventoryUiState.Content): InventoryUiState.Content {
        val filtered = if (state.searchQuery.isBlank()) {
            state.inventoryItems
        } else {
            state.inventoryItems.filter { item ->
                item.productName.contains(state.searchQuery, ignoreCase = true) ||
                        item.sku.contains(state.searchQuery, ignoreCase = true) ||
                        item.location.contains(state.searchQuery, ignoreCase = true)
            }
        }
        return state.copy(filteredItems = filtered)
    }

    class Factory(private val productRepository: ProductRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return InventoryViewModel(productRepository) as T
        }
    }
}
