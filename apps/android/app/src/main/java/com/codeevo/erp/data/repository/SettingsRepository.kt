package com.codeevo.erp.data.repository

import com.codeevo.erp.data.dto.SettingsDto
import com.codeevo.erp.data.dto.UpdateCompanyRequestDto
import com.codeevo.erp.data.dto.UpdateSettingsRequestDto
import com.codeevo.erp.data.network.ErpApiService
import com.codeevo.erp.data.network.unwrap

/**
 * Configuración real de la empresa:
 *  - GET/PATCH /companies (empresa propia, siempre la del token).
 *  - GET/PATCH /settings   (taxRate, allowNegativeStock — singleton).
 */
class SettingsRepository(
    private val apiService: ErpApiService
) {

    data class SettingsSnapshot(
        val company: com.codeevo.erp.data.dto.CompanyDto,
        val settings: SettingsDto
    )

    suspend fun getSnapshot(): Result<SettingsSnapshot> = apiResult {
        SettingsSnapshot(
            company = apiService.getCompany().unwrap(),
            settings = apiService.getSettings().unwrap()
        )
    }

    suspend fun updateCompany(
        id: String,
        company: com.codeevo.erp.data.dto.CompanyDto
    ): Result<com.codeevo.erp.data.dto.CompanyDto> = apiResult {
        apiService.updateCompany(
            id,
            UpdateCompanyRequestDto(
                name = company.name.trim().ifBlank { null },
                legalName = company.legalName?.trim()?.ifBlank { null },
                taxId = company.taxId?.trim()?.ifBlank { null },
                phone = company.phone?.trim()?.ifBlank { null },
                email = company.email?.trim()?.ifBlank { null },
                address = company.address?.trim()?.ifBlank { null }
            )
        ).unwrap()
    }

    suspend fun updateSettings(
        taxRatePercent: Double?,
        allowNegativeStock: Boolean?
    ): Result<SettingsDto> = apiResult {
        // El backend guarda taxRate como fracción [0..1] (0.21 = 21%).
        apiService.updateSettings(
            UpdateSettingsRequestDto(
                taxRate = taxRatePercent?.let { (it / 100.0).coerceIn(0.0, 1.0) },
                allowNegativeStock = allowNegativeStock
            )
        ).unwrap()
    }
}
