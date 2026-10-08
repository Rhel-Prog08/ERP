package com.codeevo.erp.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.codeevo.erp.data.dto.CompanyDto
import com.codeevo.erp.data.repository.SettingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface SettingsUiState {
    data object Loading : SettingsUiState

    /**
     * Datos reales de GET /companies + GET /settings.
     * [saved]/[message] reflejan el resultado del último PATCH (sin ocultar errores).
     */
    data class Content(
        val companyId: String,
        val companyName: String,
        val legalName: String,
        val taxId: String,
        val address: String,
        val phone: String,
        val email: String,
        /** El backend guarda la tasa como fracción (0.21); la UI en porcentaje (21). */
        val taxRatePercent: Double,
        val allowNegativeStock: Boolean,
        val saved: Boolean = false,
        val message: String? = null
    ) : SettingsUiState

    data class Error(val message: String) : SettingsUiState
}

/**
 * Configuración real de la empresa contra GET/PATCH /companies y /settings.
 * La pantalla ya no muestra valores fijos de ejemplo.
 */
class SettingsViewModel(
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadSettings()
    }

    fun loadSettings() {
        viewModelScope.launch {
            _uiState.value = SettingsUiState.Loading
            settingsRepository.getSnapshot().fold(
                onSuccess = { snapshot ->
                    _uiState.value = snapshot.toContent()
                },
                onFailure = { e ->
                    _uiState.value = SettingsUiState.Error(
                        e.message ?: "No se pudo leer la configuración de la empresa"
                    )
                }
            )
        }
    }

    fun save(
        companyName: String,
        legalName: String,
        taxId: String,
        address: String,
        phone: String,
        taxRatePercent: Double
    ) {
        viewModelScope.launch {
            val current = _uiState.value as? SettingsUiState.Content ?: return@launch
            if (companyName.isBlank()) {
                _uiState.value = current.copy(saved = false, message = "El nombre de la empresa es obligatorio")
                return@launch
            }

            val companyResult = settingsRepository.updateCompany(
                current.companyId,
                CompanyDto(
                    id = current.companyId,
                    name = companyName.trim(),
                    legalName = legalName.trim().ifBlank { null },
                    taxId = taxId.trim().ifBlank { null },
                    phone = phone.trim().ifBlank { null },
                    email = current.email.ifBlank { null },
                    address = address.trim().ifBlank { null }
                )
            )
            companyResult.fold(
                onSuccess = { company ->
                    settingsRepository.updateSettings(taxRatePercent, null).fold(
                        onSuccess = { settings ->
                            _uiState.value = SettingsUiState.Content(
                                companyId = company.id,
                                companyName = company.name,
                                legalName = company.legalName.orEmpty(),
                                taxId = company.taxId.orEmpty(),
                                address = company.address.orEmpty(),
                                phone = company.phone.orEmpty(),
                                email = company.email.orEmpty(),
                                taxRatePercent = settings.taxRate * 100.0,
                                allowNegativeStock = settings.allowNegativeStock,
                                saved = true,
                                message = "Ajustes de empresa guardados exitosamente"
                            )
                        },
                        onFailure = { e ->
                            _uiState.value = current.copy(
                                saved = false,
                                message = "Empresa guardada, pero ajustes no: ${e.message}"
                            )
                        }
                    )
                },
                onFailure = { e ->
                    _uiState.value = current.copy(
                        saved = false,
                        message = e.message ?: "No se pudieron guardar los datos de la empresa"
                    )
                }
            )
        }
    }

    private fun SettingsRepository.SettingsSnapshot.toContent() = SettingsUiState.Content(
        companyId = company.id,
        companyName = company.name,
        legalName = company.legalName.orEmpty(),
        taxId = company.taxId.orEmpty(),
        address = company.address.orEmpty(),
        phone = company.phone.orEmpty(),
        email = company.email.orEmpty(),
        taxRatePercent = settings.taxRate * 100.0,
        allowNegativeStock = settings.allowNegativeStock
    )

    class Factory(
        private val settingsRepository: SettingsRepository
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return SettingsViewModel(settingsRepository) as T
        }
    }
}
