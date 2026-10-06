package com.example.erp.data.repository

import com.example.erp.data.network.ErpApiService
import com.example.erp.domain.model.*

class SalesRepository(
    private val apiService: ErpApiService
) {
    private val inMemorySales = mockSales.toMutableList()
    private val inMemoryPurchases = mockPurchases.toMutableList()
    private val inMemoryCustomers = mockCustomers.toMutableList()
    private val inMemorySuppliers = mockSuppliers.toMutableList()

    suspend fun getSales(): Result<List<Sale>> {
        return try {
            val response = apiService.getSales()
            if (response.isSuccessful && !response.body().isNullOrEmpty()) {
                Result.success(response.body()!!)
            } else {
                Result.success(inMemorySales)
            }
        } catch (e: Exception) {
            Result.success(inMemorySales)
        }
    }

    suspend fun createSale(sale: Sale): Result<Sale> {
        return try {
            val response = apiService.createSale(sale)
            if (response.isSuccessful && response.body() != null) {
                val newSale = response.body()!!
                inMemorySales.add(0, newSale)
                Result.success(newSale)
            } else {
                inMemorySales.add(0, sale)
                Result.success(sale)
            }
        } catch (e: Exception) {
            inMemorySales.add(0, sale)
            Result.success(sale)
        }
    }

    suspend fun updateSaleStatus(saleId: String, status: DocumentStatus): Result<Sale> {
        val index = inMemorySales.indexOfFirst { it.id == saleId }
        if (index != -1) {
            val updated = inMemorySales[index].copy(status = status)
            inMemorySales[index] = updated
            return Result.success(updated)
        }
        return Result.failure(Exception("Sale not found"))
    }

    suspend fun getPurchases(): Result<List<Purchase>> {
        return try {
            val response = apiService.getPurchases()
            if (response.isSuccessful && !response.body().isNullOrEmpty()) {
                Result.success(response.body()!!)
            } else {
                Result.success(inMemoryPurchases)
            }
        } catch (e: Exception) {
            Result.success(inMemoryPurchases)
        }
    }

    suspend fun createPurchase(purchase: Purchase): Result<Purchase> {
        return try {
            val response = apiService.createPurchase(purchase)
            if (response.isSuccessful && response.body() != null) {
                val newPurchase = response.body()!!
                inMemoryPurchases.add(0, newPurchase)
                Result.success(newPurchase)
            } else {
                inMemoryPurchases.add(0, purchase)
                Result.success(purchase)
            }
        } catch (e: Exception) {
            inMemoryPurchases.add(0, purchase)
            Result.success(purchase)
        }
    }

    suspend fun updatePurchaseStatus(purchaseId: String, status: DocumentStatus): Result<Purchase> {
        val index = inMemoryPurchases.indexOfFirst { it.id == purchaseId }
        if (index != -1) {
            val updated = inMemoryPurchases[index].copy(status = status)
            inMemoryPurchases[index] = updated
            return Result.success(updated)
        }
        return Result.failure(Exception("Purchase not found"))
    }

    suspend fun getCustomers(): Result<List<Customer>> {
        return try {
            val response = apiService.getCustomers()
            if (response.isSuccessful && !response.body().isNullOrEmpty()) {
                Result.success(response.body()!!)
            } else {
                Result.success(inMemoryCustomers)
            }
        } catch (e: Exception) {
            Result.success(inMemoryCustomers)
        }
    }

    suspend fun addCustomer(customer: Customer): Result<Customer> {
        inMemoryCustomers.add(0, customer)
        return Result.success(customer)
    }

    suspend fun updateCustomer(customer: Customer): Result<Customer> {
        val index = inMemoryCustomers.indexOfFirst { it.id == customer.id }
        if (index != -1) {
            inMemoryCustomers[index] = customer
        } else {
            inMemoryCustomers.add(0, customer)
        }
        return Result.success(customer)
    }

    suspend fun getSuppliers(): Result<List<Supplier>> {
        return try {
            val response = apiService.getSuppliers()
            if (response.isSuccessful && !response.body().isNullOrEmpty()) {
                Result.success(response.body()!!)
            } else {
                Result.success(inMemorySuppliers)
            }
        } catch (e: Exception) {
            Result.success(inMemorySuppliers)
        }
    }

    suspend fun addSupplier(supplier: Supplier): Result<Supplier> {
        inMemorySuppliers.add(0, supplier)
        return Result.success(supplier)
    }

    suspend fun updateSupplier(supplier: Supplier): Result<Supplier> {
        val index = inMemorySuppliers.indexOfFirst { it.id == supplier.id }
        if (index != -1) {
            inMemorySuppliers[index] = supplier
        } else {
            inMemorySuppliers.add(0, supplier)
        }
        return Result.success(supplier)
    }

    companion object {
        val mockCustomers = listOf(
            Customer(
                id = "cust_001",
                name = "Acme Solutions Corp",
                email = "contact@acmesolutions.com",
                phone = "+1 555-0192",
                company = "Acme Solutions",
                address = "100 Innovation Way, Silicon Valley, CA",
                totalPurchases = 12450.00
            ),
            Customer(
                id = "cust_002",
                name = "Global Logistics Ltd",
                email = "procurement@globallogistics.com",
                phone = "+1 555-0388",
                company = "Global Logistics",
                address = "450 Harbor Blvd, Chicago, IL",
                totalPurchases = 48200.00
            ),
            Customer(
                id = "cust_003",
                name = "Apex Industries",
                email = "billing@apexind.com",
                phone = "+1 555-0721",
                company = "Apex Industries",
                address = "789 Industrial Pkwy, Austin, TX",
                totalPurchases = 9850.00
            )
        )

        val mockSuppliers = listOf(
            Supplier(
                id = "supp_001",
                name = "Dell Enterprise Systems",
                contactPerson = "Marcus Brody",
                email = "orders@dellenterprise.com",
                phone = "+1 800-456-3355",
                address = "One Dell Way, Round Rock, TX",
                categoriesSupplied = listOf("Hardware", "Workstations", "Servers")
            ),
            Supplier(
                id = "supp_002",
                name = "Cisco Global Wholesale",
                contactPerson = "Elena Rostova",
                email = "partner@cisco.com",
                phone = "+1 800-553-6387",
                address = "170 West Tasman Dr, San Jose, CA",
                categoriesSupplied = listOf("Networking", "Switches", "Routers")
            )
        )

        val mockSales = listOf(
            Sale(
                id = "sale_001",
                saleNumber = "INV-2025-089",
                customerId = "cust_001",
                customerName = "Acme Solutions Corp",
                items = listOf(
                    SaleItem("prod_001", "CodeEvo Pro Workstation Tower", 2, 2499.99, 4999.98)
                ),
                totalAmount = 4999.98,
                date = System.currentTimeMillis() - 86400000L * 2,
                status = DocumentStatus.COMPLETED
            ),
            Sale(
                id = "sale_002",
                saleNumber = "INV-2025-090",
                customerId = "cust_002",
                customerName = "Global Logistics Ltd",
                items = listOf(
                    SaleItem("prod_004", "CodeEvo ERP Cloud License (1 Year)", 10, 450.00, 4500.00)
                ),
                totalAmount = 4500.00,
                date = System.currentTimeMillis() - 86400000L * 1,
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
                date = System.currentTimeMillis(),
                status = DocumentStatus.DRAFT
            )
        )

        val mockPurchases = listOf(
            Purchase(
                id = "pur_001",
                purchaseNumber = "PO-2025-409",
                supplierId = "supp_001",
                supplierName = "Dell Enterprise Systems",
                items = listOf(
                    PurchaseItem("prod_002", "Dell XPS 15 Enterprise", 5, 1400.00, 7000.00)
                ),
                totalAmount = 7000.00,
                date = System.currentTimeMillis() - 86400000L * 3,
                status = DocumentStatus.COMPLETED
            ),
            Purchase(
                id = "pur_002",
                purchaseNumber = "PO-2025-410",
                supplierId = "supp_002",
                supplierName = "Cisco Global Wholesale",
                items = listOf(
                    PurchaseItem("prod_003", "Cisco Catalyst 9300 Switch", 2, 2500.00, 5000.00)
                ),
                totalAmount = 5000.00,
                date = System.currentTimeMillis() - 86400000L * 1,
                status = DocumentStatus.CONFIRMED
            )
        )
    }
}
