package com.example.erp.data.repository

import com.example.erp.data.network.ErpApiService
import com.example.erp.domain.model.AuditLog

class AuditRepository(
    private val apiService: ErpApiService
) {
    private val inMemoryLogs = mockLogs.toMutableList()

    suspend fun getAuditLogs(): Result<List<AuditLog>> {
        return try {
            val response = apiService.getAuditLogs()
            if (response.isSuccessful && !response.body().isNullOrEmpty()) {
                Result.success(response.body()!!)
            } else {
                Result.success(inMemoryLogs)
            }
        } catch (e: Exception) {
            Result.success(inMemoryLogs)
        }
    }

    suspend fun addAuditLog(log: AuditLog): Result<AuditLog> {
        inMemoryLogs.add(0, log)
        return Result.success(log)
    }

    companion object {
        val mockLogs = listOf(
            AuditLog(
                id = "log_001",
                userId = "usr_001",
                userName = "Alex Vance",
                action = "Stock Movement",
                targetModule = "Inventory",
                timestamp = System.currentTimeMillis() - 1000 * 60 * 15,
                details = "Adjusted stock for SKU-1002 (Dell XPS 15) from 12 to 25 units. Reason: Monthly physical count."
            ),
            AuditLog(
                id = "log_002",
                userId = "usr_002",
                userName = "Sarah Connor",
                action = "Sale Confirmed",
                targetModule = "Sales",
                timestamp = System.currentTimeMillis() - 1000 * 60 * 120,
                details = "Confirmed Sale Order #INV-2025-089 for Acme Solutions Corp ($4,999.98)."
            ),
            AuditLog(
                id = "log_003",
                userId = "usr_001",
                userName = "Alex Vance",
                action = "PO Approved",
                targetModule = "Purchases",
                timestamp = System.currentTimeMillis() - 1000 * 60 * 360,
                details = "Approved Purchase Order #PO-2025-409 with Dell Enterprise Systems ($7,000.00)."
            ),
            AuditLog(
                id = "log_004",
                userId = "usr_003",
                userName = "David Chen",
                action = "Customer Added",
                targetModule = "Customers",
                timestamp = System.currentTimeMillis() - 1000 * 60 * 720,
                details = "Added new client 'Nexus Systems Ltd' to global customer directory."
            ),
            AuditLog(
                id = "log_005",
                userId = "usr_004",
                userName = "Maria Rodriguez",
                action = "Inbound Stock",
                targetModule = "Inventory",
                timestamp = System.currentTimeMillis() - 1000 * 60 * 1440,
                details = "Received 50 units of SKU-1005 (Logitech MX Master 3S) into Warehouse A."
            )
        )
    }
}
