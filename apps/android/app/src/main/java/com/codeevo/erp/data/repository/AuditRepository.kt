package com.codeevo.erp.data.repository

import com.codeevo.erp.data.mapper.toDomain
import com.codeevo.erp.data.network.ErpApiService
import com.codeevo.erp.domain.model.AuditLog

/**
 * GET /audit — bitácora inmutable del backend (sólo lectura; el modelo
 * bloquea escrituras y no existe endpoint de creación).
 */
class AuditRepository(
    private val apiService: ErpApiService
) {

    suspend fun getAuditLogs(): Result<List<AuditLog>> = apiResult {
        fetchAllPages { page, limit -> apiService.getAuditLogs(page, limit) }
            .map { it.toDomain() }
    }
}
