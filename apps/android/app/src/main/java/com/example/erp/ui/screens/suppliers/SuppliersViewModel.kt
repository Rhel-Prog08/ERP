package com.example.erp.ui.screens.suppliers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.erp.data.repository.SalesRepository
import com.example.erp.domain.model.Supplier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface SuppliersUiState {
    data object Loading : SuppliersUiState
    data class Content(
        val suppliers: List<Supplier>,
        val filteredSuppliers: List<Supplier>,
        val searchQuery: String = ""
    ) : SuppliersUiState
    data class Error(val message: String) : SuppliersUiState
}

class SuppliersViewModel(
    private val salesRepository: SalesRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<SuppliersUiState>(SuppliersUiState.Loading)
    val uiState: StateFlow<SuppliersUiState> = _uiState.asStateFlow()

    init {
        loadSuppliers()
    }

    fun loadSuppliers() {
        viewModelScope.launch {
            _uiState.value = SuppliersUiState.Loading
            try {
                val res = salesRepository.getSuppliers()
                val list = res.getOrDefault(emptyList())
                val state = SuppliersUiState.Content(
                    suppliers = list,
                    filteredSuppliers = list
                )
                _uiState.value = filterSuppliers(state)
            } catch (e: Exception) {
                _uiState.value = SuppliersUiState.Error(e.message ?: "Error al cargar proveedores")
            }
        }
    }

    fun setSearchQuery(query: String) {
        val current = _uiState.value as? SuppliersUiState.Content ?: return
        _uiState.value = filterSuppliers(current.copy(searchQuery = query))
    }

    fun addSupplier(supplier: Supplier) {
        viewModelScope.launch {
            salesRepository.addSupplier(supplier)
            loadSuppliers()
        }
    }

    fun updateSupplier(supplier: Supplier) {
        viewModelScope.launch {
            salesRepository.updateSupplier(supplier)
            loadSuppliers()
        }
    }

    private fun filterSuppliers(state: SuppliersUiState.Content): SuppliersUiState.Content {
        val filtered = if (state.searchQuery.isBlank()) {
            state.suppliers
        } else {
            state.suppliers.filter { s ->
                s.name.contains(state.searchQuery, ignoreCase = true) ||
                        s.contactPerson.contains(state.searchQuery, ignoreCase = true) ||
                        s.email.contains(state.searchQuery, ignoreCase = true)
            }
        }
        return state.copy(filteredSuppliers = filtered)
    }

    class Factory(private val salesRepository: SalesRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return SuppliersViewModel(salesRepository) as T
        }
    }
}
