package com.codeevo.erp.ui.screens.customers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.codeevo.erp.data.repository.SalesRepository
import com.codeevo.erp.domain.model.Customer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface CustomersUiState {
    data object Loading : CustomersUiState
    data class Content(
        val customers: List<Customer>,
        val filteredCustomers: List<Customer>,
        val searchQuery: String = ""
    ) : CustomersUiState
    data class Error(val message: String) : CustomersUiState
}

class CustomersViewModel(
    private val salesRepository: SalesRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<CustomersUiState>(CustomersUiState.Loading)
    val uiState: StateFlow<CustomersUiState> = _uiState.asStateFlow()

    init {
        loadCustomers()
    }

    fun loadCustomers() {
        viewModelScope.launch {
            _uiState.value = CustomersUiState.Loading
            try {
                val res = salesRepository.getCustomers()
                val list = res.getOrDefault(emptyList())
                val state = CustomersUiState.Content(
                    customers = list,
                    filteredCustomers = list
                )
                _uiState.value = filterCustomers(state)
            } catch (e: Exception) {
                _uiState.value = CustomersUiState.Error(e.message ?: "Error al cargar clientes")
            }
        }
    }

    fun setSearchQuery(query: String) {
        val current = _uiState.value as? CustomersUiState.Content ?: return
        _uiState.value = filterCustomers(current.copy(searchQuery = query))
    }

    fun addCustomer(customer: Customer) {
        viewModelScope.launch {
            salesRepository.addCustomer(customer)
            loadCustomers()
        }
    }

    fun updateCustomer(customer: Customer) {
        viewModelScope.launch {
            salesRepository.updateCustomer(customer)
            loadCustomers()
        }
    }

    private fun filterCustomers(state: CustomersUiState.Content): CustomersUiState.Content {
        val filtered = if (state.searchQuery.isBlank()) {
            state.customers
        } else {
            state.customers.filter { c ->
                c.name.contains(state.searchQuery, ignoreCase = true) ||
                        c.company.contains(state.searchQuery, ignoreCase = true) ||
                        c.email.contains(state.searchQuery, ignoreCase = true) ||
                        c.phone.contains(state.searchQuery, ignoreCase = true)
            }
        }
        return state.copy(filteredCustomers = filtered)
    }

    class Factory(private val salesRepository: SalesRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return CustomersViewModel(salesRepository) as T
        }
    }
}
