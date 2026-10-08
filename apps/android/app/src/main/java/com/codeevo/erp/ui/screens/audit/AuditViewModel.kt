package com.codeevo.erp.ui.screens.audit

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.codeevo.erp.data.repository.AuditRepository
import com.codeevo.erp.domain.model.AuditLog
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface AuditUiState {
    data object Loading : AuditUiState
    data class Content(
        val logs: List<AuditLog>,
        val filteredLogs: List<AuditLog>,
        val searchQuery: String = "",
        val selectedModule: String = "Todos"
    ) : AuditUiState
    data class Error(val message: String) : AuditUiState
}

class AuditViewModel(
    private val auditRepository: AuditRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuditUiState>(AuditUiState.Loading)
    val uiState: StateFlow<AuditUiState> = _uiState.asStateFlow()

    init {
        loadAuditLogs()
    }

    fun loadAuditLogs() {
        viewModelScope.launch {
            _uiState.value = AuditUiState.Loading
            try {
                val res = auditRepository.getAuditLogs()
                val list = res.getOrDefault(emptyList())
                val state = AuditUiState.Content(
                    logs = list,
                    filteredLogs = list
                )
                _uiState.value = filterLogs(state)
            } catch (e: Exception) {
                _uiState.value = AuditUiState.Error(e.message ?: "Error al cargar bitácora de auditoría")
            }
        }
    }

    fun setSearchQuery(query: String) {
        val current = _uiState.value as? AuditUiState.Content ?: return
        _uiState.value = filterLogs(current.copy(searchQuery = query))
    }

    fun setModuleFilter(module: String) {
        val current = _uiState.value as? AuditUiState.Content ?: return
        _uiState.value = filterLogs(current.copy(selectedModule = module))
    }

    private fun filterLogs(state: AuditUiState.Content): AuditUiState.Content {
        val filtered = state.logs.filter { log ->
            val matchesQuery = state.searchQuery.isBlank() ||
                    log.userName.contains(state.searchQuery, ignoreCase = true) ||
                    log.action.contains(state.searchQuery, ignoreCase = true) ||
                    log.details.contains(state.searchQuery, ignoreCase = true)

            val matchesModule = state.selectedModule == "Todos" ||
                    log.targetModule.equals(state.selectedModule, ignoreCase = true)

            matchesQuery && matchesModule
        }
        return state.copy(filteredLogs = filtered)
    }

    class Factory(private val auditRepository: AuditRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return AuditViewModel(auditRepository) as T
        }
    }
}
