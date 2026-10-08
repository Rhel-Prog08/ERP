package com.codeevo.erp.data.repository

import com.codeevo.erp.data.mapper.parseServerDate
import com.codeevo.erp.data.network.ErpApiService
import com.codeevo.erp.data.network.unwrap
import java.util.Calendar

/** Datos reales de la pantalla de informes (todo derivado del backend). */
data class ReportCategorySales(
    val category: String,
    val amount: Double,
    val percentage: Float
)

data class MonthlyBarData(
    val month: String,
    val sales: Double,
    val purchases: Double
)

data class ReportData(
    val totalRevenue: Double,
    val totalExpenses: Double,
    val netMarginPercent: Double,
    val inventoryTurnoverRate: Double,
    val categories: List<ReportCategorySales>,
    val monthlyBars: List<MonthlyBarData>
)

/**
 * Informes financieros con datos REALES:
 *  - GET /reports/sales y /reports/purchases → totales y barras mensuales
 *    (filas con `fecha` "YYYY-MM-DD HH:MM:SS" y `total`).
 *  - GET /sales (items con sku) + GET /products → distribución por categoría.
 *  - GET /products + GET /inventory → valor de inventario para la rotación.
 *
 * La "rotación" se aproxima como gastos del periodo / valor de inventario
 * actual (no existe métrica de coste medio de inventario en el backend).
 */
class ReportRepository(
    private val apiService: ErpApiService
) {

    private val monthLabel = listOf(
        "Ene", "Feb", "Mar", "Abr", "May", "Jun",
        "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    )

    suspend fun getReportData(period: String): Result<ReportData> = apiResult {
        val periodStart = periodStartMillis(period)
        val yearStart = startOfYearMillis()

        val salesReport = apiService.getSalesReport().unwrap().rows
        val purchasesReport = apiService.getPurchasesReport().unwrap().rows

        // ---- Totales del periodo seleccionado (excluye cancelados) ----
        fun inPeriod(fecha: String?): Boolean {
            if (fecha.isNullOrBlank()) return false
            return parseServerDate(fecha.take(19).replace(' ', 'T') + "Z") >= periodStart
        }
        val totalRevenue = salesReport
            .filter { it.estado != "CANCELLED" && inPeriod(it.fecha) }
            .sumOf { it.total ?: 0.0 }
        val totalExpenses = purchasesReport
            .filter { it.estado != "CANCELLED" && inPeriod(it.fecha) }
            .sumOf { it.total ?: 0.0 }
        val netMargin = if (totalRevenue > 0) (totalRevenue - totalExpenses) / totalRevenue * 100.0 else 0.0

        // ---- Barras mensuales (año en curso, ventas vs compras) ----
        val salesByMonth = salesReport
            .filter { it.estado != "CANCELLED" }
            .filter { parseServerDate(it.fecha?.take(19)?.replace(' ', 'T')?.plus("Z")) >= yearStart }
            .groupingBy { (it.fecha ?: "").take(7) }
            .fold(0.0) { acc, row -> acc + (row.total ?: 0.0) }
        val purchasesByMonth = purchasesReport
            .filter { it.estado != "CANCELLED" }
            .filter { parseServerDate(it.fecha?.take(19)?.replace(' ', 'T')?.plus("Z")) >= yearStart }
            .groupingBy { (it.fecha ?: "").take(7) }
            .fold(0.0) { acc, row -> acc + (row.total ?: 0.0) }

        val monthlyBars = (salesByMonth.keys + purchasesByMonth.keys)
            .filter { it.length == 7 }
            .distinct()
            .sorted()
            .map { key ->
                val monthNumber = key.substring(5, 7).toIntOrNull() ?: 1
                MonthlyBarData(
                    month = monthLabel.getOrElse(monthNumber - 1) { key },
                    sales = salesByMonth[key] ?: 0.0,
                    purchases = purchasesByMonth[key] ?: 0.0
                )
            }

        // ---- Distribución por categoría (ítems de venta reales) ----
        val products = fetchAllPages { page, limit -> apiService.getProducts(page, limit) }
        // /categories resuelve categoryId → nombre (el listado NO popula).
        val categoryNames = try {
            fetchAllPages { page, limit -> apiService.getCategories(page, limit) }
                .associate { it.id to it.name }
        } catch (e: Exception) {
            emptyMap<String, String>()
        }
        val categoryBySku = products.associate { product ->
            product.sku to (product.categoryId?.id?.let { categoryNames[it] } ?: "Sin categoría")
        }
        val categoryById = products.associate { product ->
            product.id to (product.categoryId?.id?.let { categoryNames[it] } ?: "Sin categoría")
        }

        val sales = fetchAllPages { page, limit -> apiService.getSales(page, limit) }
        val categoryTotals = sales
            .filter { it.status != "CANCELLED" && parseServerDate(it.createdAt) >= periodStart }
            .flatMap { sale -> sale.items }
            .groupingBy { item ->
                categoryBySku[item.sku ?: ""] ?: categoryById[item.productId] ?: "Sin categoría"
            }
            .fold(0.0) { acc, item -> acc + item.subtotal }
        val categoriesTotal = categoryTotals.values.sum()
        val categories = categoryTotals.entries
            .sortedByDescending { it.value }
            .map { (category, amount) ->
                ReportCategorySales(
                    category = category,
                    amount = amount,
                    percentage = if (categoriesTotal > 0) (amount / categoriesTotal).toFloat() else 0f
                )
            }

        // ---- Rotación ≈ gastos del periodo / valor de inventario ----
        val priceById = products.associate { it.id to it.purchasePrice }
        val inventoryValue = try {
            fetchAllPages { page, limit -> apiService.getInventory(page, limit) }
                .sumOf { balance -> (priceById[balance.productId?.id] ?: 0.0) * balance.quantity }
        } catch (e: Exception) {
            0.0
        }
        val turnover = if (inventoryValue > 0) totalExpenses / inventoryValue else 0.0

        ReportData(
            totalRevenue = totalRevenue,
            totalExpenses = totalExpenses,
            netMarginPercent = netMargin,
            inventoryTurnoverRate = turnover,
            categories = categories,
            monthlyBars = monthlyBars
        )
    }

    /** Inicio del rango según el filtro de la UI. */
    fun periodStartMillis(period: String): Long = when (period) {
        "Hoy" -> startOfTodayMillis()
        "Esta Semana" -> System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000
        "Año Actual" -> startOfYearMillis()
        else -> startOfMonthMillis() // "Este Mes"
    }

    private fun startOfTodayMillis(): Long = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.timeInMillis

    private fun startOfMonthMillis(): Long = Calendar.getInstance().apply {
        set(Calendar.DAY_OF_MONTH, 1)
        set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.timeInMillis

    private fun startOfYearMillis(): Long = Calendar.getInstance().apply {
        set(Calendar.MONTH, Calendar.JANUARY)
        set(Calendar.DAY_OF_MONTH, 1)
        set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.timeInMillis
}
