package com.example.erp.ui.screens.products

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.erp.data.repository.ProductRepository
import com.example.erp.domain.model.InventoryStatus
import com.example.erp.domain.model.Product
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface ProductsUiState {
    data object Loading : ProductsUiState
    data class Content(
        val products: List<Product>,
        val filteredProducts: List<Product>,
        val categories: List<String>,
        val searchQuery: String = "",
        val selectedCategory: String = "Todas",
        val selectedStatus: String = "Todos"
    ) : ProductsUiState
    data class Error(val message: String) : ProductsUiState
}

class ProductsViewModel(
    private val productRepository: ProductRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ProductsUiState>(ProductsUiState.Loading)
    val uiState: StateFlow<ProductsUiState> = _uiState.asStateFlow()

    init {
        loadProducts()
    }

    fun loadProducts() {
        viewModelScope.launch {
            _uiState.value = ProductsUiState.Loading
            val result = productRepository.getProducts()
            result.fold(
                onSuccess = { products ->
                    val categories = listOf("Todas") + products.map { it.category }.distinct().sorted()
                    val currentState = ProductsUiState.Content(
                        products = products,
                        filteredProducts = products,
                        categories = categories
                    )
                    _uiState.value = filterProducts(currentState)
                },
                onFailure = {
                    _uiState.value = ProductsUiState.Error(it.message ?: "Error al cargar productos")
                }
            )
        }
    }

    fun setSearchQuery(query: String) {
        val current = _uiState.value as? ProductsUiState.Content ?: return
        _uiState.value = filterProducts(current.copy(searchQuery = query))
    }

    fun setCategoryFilter(category: String) {
        val current = _uiState.value as? ProductsUiState.Content ?: return
        _uiState.value = filterProducts(current.copy(selectedCategory = category))
    }

    fun setStatusFilter(status: String) {
        val current = _uiState.value as? ProductsUiState.Content ?: return
        _uiState.value = filterProducts(current.copy(selectedStatus = status))
    }

    fun addProduct(product: Product) {
        viewModelScope.launch {
            productRepository.addProduct(product)
            loadProducts()
        }
    }

    fun updateProduct(product: Product) {
        viewModelScope.launch {
            productRepository.updateProduct(product)
            loadProducts()
        }
    }

    private fun filterProducts(state: ProductsUiState.Content): ProductsUiState.Content {
        val filtered = state.products.filter { product ->
            val matchesQuery = state.searchQuery.isBlank() ||
                    product.name.contains(state.searchQuery, ignoreCase = true) ||
                    product.sku.contains(state.searchQuery, ignoreCase = true) ||
                    product.category.contains(state.searchQuery, ignoreCase = true)

            val matchesCategory = state.selectedCategory == "Todas" || product.category.equals(state.selectedCategory, ignoreCase = true)

            val invStatus = when {
                product.stockQuantity <= 0 -> InventoryStatus.OUT_OF_STOCK
                product.stockQuantity <= product.minStockLevel -> InventoryStatus.LOW
                else -> InventoryStatus.NORMAL
            }

            val matchesStatus = when (state.selectedStatus) {
                "Normal" -> invStatus == InventoryStatus.NORMAL
                "Bajo Stock" -> invStatus == InventoryStatus.LOW
                "Agotado" -> invStatus == InventoryStatus.OUT_OF_STOCK
                else -> true
            }

            matchesQuery && matchesCategory && matchesStatus
        }

        return state.copy(filteredProducts = filtered)
    }

    class Factory(private val productRepository: ProductRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return ProductsViewModel(productRepository) as T
        }
    }
}
