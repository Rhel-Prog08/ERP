package com.example.erp.data.repository

import com.example.erp.data.network.ErpApiService
import com.example.erp.domain.model.AuditLog
import com.example.erp.domain.model.DashboardKpis
import com.example.erp.domain.model.DocumentStatus
import com.example.erp.domain.model.Product
import com.example.erp.domain.model.Sale
import com.example.erp.domain.model.SaleItem
import com.example.erp.domain.model.TopProduct

class DashboardRepository(
    private val apiService: ErpApiService
) {

    suspend fun getDashboardKpis(): Result<DashboardKpis> {
        return try {
            val response = apiService.getDashboardKpis()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(mockDashboardKpis)
            }
        } catch (e: Exception) {
            Result.success(mockDashboardKpis)
        }
    }

    suspend fun getRecentSales(): Result<List<Sale>> {
        return Result.success(mockRecentSales)
    }

    suspend fun getLowStockProducts(): Result<List<Product>> {
        return Result.success(mockLowStockProducts)
    }

    suspend fun getTopSellingProducts(): Result<List<TopProduct>> {
        return Result.success(mockTopProducts)
    }

    suspend fun getAuditLogs(): Result<List<AuditLog>> {
        return try {
            val response = apiService.getAuditLogs()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(mockAuditLogs)
            }
        } catch (e: Exception) {
            Result.success(mockAuditLogs)
        }
    }

    companion object {
        private val mockDashboardKpis = DashboardKpis(
            totalRevenue = 284500.00,
            revenueGrowthPercent = 14.2,
            totalOrders = 1240,
            ordersGrowthPercent = 8.5,
            lowStockItemsCount = 8,
            activeCustomersCount = 382,
            totalExpenses = 142000.00,
            netProfit = 142500.00
        )

        private val mockRecentSales = listOf(
            Sale(
                id = "sale_001",
                saleNumber = "INV-2025-089",
                customerId = "cust_001",
                customerName = "Acme Solutions Corp",
                items = listOf(
                    SaleItem("prod_001", "CodeEvo Pro Workstation Tower", 2, 2499.99, 4999.98)
                ),
                totalAmount = 4999.98,
                date = System.currentTimeMillis() - 1000 * 60 * 45,
                status = DocumentStatus.COMPLETED
            ),
            Sale(
                id = "sale_002",
                saleNumber = "INV-2025-090",
                customerId = "cust_002",
                customerName = "Global Logistics Ltd",
                items = listOf(
                    SaleItem("prod_004", "CodeEvo ERP Cloud License", 10, 450.00, 4500.00)
                ),
                totalAmount = 4500.00,
                date = System.currentTimeMillis() - 1000 * 60 * 180,
                status = DocumentStatus.CONFIRMED
            ),
            Sale(
                id = "sale_003",
                saleNumber = "INV-2025-091",
                customerId = "cust_003",
                customerName = "Apex Industries",
                items = listOf(
                    SaleItem("prod_005", "Logitech MX Master 3S", 5, 99.99, 499.95)
                ),
                totalAmount = 499.95,
                date = System.currentTimeMillis() - 1000 * 60 * 360,
                status = DocumentStatus.DRAFT
            )
        )

        private val mockLowStockProducts = listOf(
            Product("prod_002", "SKU-1002", "Dell XPS 15 Enterprise", "Laptop para dirección", "Hardware", 1899.50, 1400.00, 3, 10, "pcs"),
            Product("prod_003", "SKU-1003", "Cisco Catalyst 9300 Switch", "Switch Gigabit PoE+", "Networking", 3200.00, 2500.00, 0, 2, "pcs"),
            Product("prod_006", "SKU-1006", "Monitor Dell UltraSharp 27\"", "4K USB-C Hub Monitor", "Hardware", 620.00, 450.00, 2, 8, "pcs"),
            Product("prod_007", "SKU-1007", "Teclado Mecánico Keychron Q1", "Teclado custom inalámbrico", "Peripherals", 180.00, 110.00, 4, 12, "pcs")
        )

        private val mockTopProducts = listOf(
            TopProduct("prod_001", "CodeEvo Pro Workstation", "Hardware", 42, 104999.58, 0.92f),
            TopProduct("prod_004", "ERP Cloud License (1 Year)", "Software", 180, 81000.00, 0.85f),
            TopProduct("prod_003", "Cisco Catalyst 9300 Switch", "Networking", 15, 48000.00, 0.70f),
            TopProduct("prod_005", "Logitech MX Master 3S", "Peripherals", 120, 11998.80, 0.60f)
        )

        private val mockAuditLogs = listOf(
            AuditLog(
                id = "log_001",
                userId = "usr_001",
                userName = "Alex Vance",
                action = "Ajuste de Stock",
                targetModule = "Inventario",
                timestamp = System.currentTimeMillis() - 1000 * 60 * 15,
                details = "Ajuste manual de stock para SKU-1002 (Dell XPS 15) de 12 a 25 unidades.",
                payloadBefore = "{\n  \"stockQuantity\": 12,\n  \"reason\": \"Conteo físico\"\n}",
                payloadAfter = "{\n  \"stockQuantity\": 25,\n  \"reason\": \"Conteo físico finalizado\"\n}"
            ),
            AuditLog(
                id = "log_002",
                userId = "usr_002",
                userName = "Sarah Connor",
                action = "Venta Confirmada",
                targetModule = "Ventas",
                timestamp = System.currentTimeMillis() - 1000 * 60 * 120,
                details = "Confirmación de factura #INV-2025-089 para Acme Solutions Corp ($4,999.98).",
                payloadBefore = "{\n  \"status\": \"DRAFT\"\n}",
                payloadAfter = "{\n  \"status\": \"CONFIRMED\"\n}"
            ),
            AuditLog(
                id = "log_003",
                userId = "usr_001",
                userName = "Alex Vance",
                action = "Orden Aprobada",
                targetModule = "Compras",
                timestamp = System.currentTimeMillis() - 1000 * 60 * 360,
                details = "Aprobación de Orden de Compra #PO-2025-409 con Dell Enterprise Systems.",
                payloadBefore = "{\n  \"status\": \"DRAFT\"\n}",
                payloadAfter = "{\n  \"status\": \"CONFIRMED\"\n}"
            ),
            AuditLog(
                id = "log_004",
                userId = "usr_003",
                userName = "David Chen",
                action = "Cliente Registrado",
                targetModule = "Clientes",
                timestamp = System.currentTimeMillis() - 1000 * 60 * 720,
                details = "Alta de nuevo cliente 'Nexus Systems Ltd' en directorio global.",
                payloadBefore = null,
                payloadAfter = "{\n  \"name\": \"Nexus Systems Ltd\",\n  \"company\": \"Nexus Ltd\"\n}"
            )
        )
    }
}
