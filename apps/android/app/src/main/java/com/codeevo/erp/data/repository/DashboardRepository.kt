package com.codeevo.erp.data.repository

import com.codeevo.erp.data.dto.DashboardDto
import com.codeevo.erp.data.mapper.parseServerDate
import com.codeevo.erp.data.mapper.toDomain
import com.codeevo.erp.data.network.ErpApiService
import com.codeevo.erp.data.network.unwrap
import com.codeevo.erp.domain.model.AuditLog
import com.codeevo.erp.domain.model.DashboardKpis
import com.codeevo.erp.domain.model.Product
import com.codeevo.erp.domain.model.Sale
import com.codeevo.erp.domain.model.TopProduct

/**
 * GET /dashboard — un solo viaje trae KPIs, ventas/compras recientes,
 * stock bajo y top productos (agregaciones reales del backend).
 * La respuesta se cachea para que las cinco consultas de la pantalla
 * del dashboard no repitan la petición; [invalidate] la refresca.
 *
 * `getAuditLogs` consulta GET /audit (bitácora real, sólo lectura).
 */
class DashboardRepository(
    private val apiService: ErpApiService
) {

    @Volatile
    private var cachedDashboard: DashboardDto? = null

    private suspend fun dashboard(): Result<DashboardDto> = apiResult {
        cachedDashboard ?: apiService.getDashboard().unwrap().also { cachedDashboard = it }
    }

    suspend fun getDashboardKpis(): Result<DashboardKpis> =
        dashboard().map { it.kpi.toDomain() }

    suspend fun getRecentSales(): Result<List<Sale>> =
        dashboard().map { data -> data.recentSales.map { it.toDomain() } }

    suspend fun getLowStockProducts(): Result<List<Product>> =
        dashboard().map { data -> data.lowStock.map { it.toDomain() } }

    suspend fun getTopSellingProducts(): Result<List<TopProduct>> = dashboard().map { data ->
        val maxUnits = data.topProducts.maxOfOrNull { it.quantity }?.toInt() ?: 0
        data.topProducts.map { it.toDomain(maxUnits) }
    }

    /** GET /audit — entradas más recientes primero, recorriendo la paginación. */
    suspend fun getAuditLogs(): Result<List<AuditLog>> = apiResult {
        fetchAllPages { page, limit -> apiService.getAuditLogs(page, limit) }
            .map { it.toDomain() }
    }

    fun invalidate() {
        cachedDashboard = null
    }
}
