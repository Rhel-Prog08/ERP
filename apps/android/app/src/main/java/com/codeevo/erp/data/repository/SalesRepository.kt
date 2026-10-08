package com.codeevo.erp.data.repository

import com.codeevo.erp.data.dto.CancelDocumentRequestDto
import com.codeevo.erp.data.dto.CreateCustomerRequestDto
import com.codeevo.erp.data.dto.CreateDocumentItemDto
import com.codeevo.erp.data.dto.CreatePurchaseRequestDto
import com.codeevo.erp.data.dto.CreateSaleRequestDto
import com.codeevo.erp.data.dto.CreateSupplierRequestDto
import com.codeevo.erp.data.mapper.toDomain
import com.codeevo.erp.data.network.ApiException
import com.codeevo.erp.data.network.ErpApiService
import com.codeevo.erp.data.network.unwrap
import com.codeevo.erp.domain.model.Customer
import com.codeevo.erp.domain.model.DocumentStatus
import com.codeevo.erp.domain.model.Purchase
import com.codeevo.erp.domain.model.Sale
import com.codeevo.erp.domain.model.Supplier

/**
 * Operaciones comerciales contra el backend real.
 *
 * Contratos importantes:
 *  - Ventas/compras se CREAN como borrador en el servidor y los totales los
 *    calcula el backend (subtotal + impuestos de la empresa): el cliente sólo
 *    envía productId/cantidad/precio unitario.
 *  - El almacén lo aporta [defaultWarehouse] (la UI no tiene selector).
 *  - Estados: DRAFT → confirm → complete|receive → cancel (motivo obligatorio).
 *  - clientes/proveedores: PATCH/POST con los campos reales; el código
 *    (CL-/PR-) lo genera el servidor.
 */
class SalesRepository(
    private val apiService: ErpApiService
) {

    /* --------------------------------- Ventas ------------------------------- */

    suspend fun getSales(): Result<List<Sale>> = apiResult {
        fetchAllPages { page, limit -> apiService.getSales(page, limit) }
            .map { it.toDomain() }
    }

    suspend fun createSale(sale: Sale): Result<Sale> = apiResult {
        val warehouse = apiService.defaultWarehouse()
        if (sale.customerId.isBlank()) {
            throw ApiException("CUSTOMER_REQUIRED", "Seleccione un cliente para la venta")
        }
        var created = apiService.createSale(
            CreateSaleRequestDto(
                customerId = sale.customerId,
                warehouseId = warehouse.id,
                items = sale.items.map {
                    CreateDocumentItemDto(
                        productId = it.productId,
                        quantity = it.quantity.toDouble(),
                        unitPrice = it.unitPrice
                    )
                }
            )
        ).unwrap()

        // La UI crea la venta como "Confirmada": el backend la emite en DRAFT
        // y con sales.update la confirmamos para respetar esa intención.
        if (sale.status == DocumentStatus.CONFIRMED) {
            created = apiService.confirmSale(created.id).unwrap()
        }
        created.toDomain()
    }

    suspend fun updateSaleStatus(saleId: String, status: DocumentStatus): Result<Sale> = apiResult {
        val updated = when (status) {
            DocumentStatus.CONFIRMED -> apiService.confirmSale(saleId).unwrap()
            DocumentStatus.COMPLETED -> apiService.completeSale(saleId).unwrap()
            DocumentStatus.CANCELLED -> apiService.cancelSale(
                saleId,
                CancelDocumentRequestDto("Cancelado desde la aplicación Android")
            ).unwrap()
            DocumentStatus.DRAFT -> throw ApiException(
                "INVALID_TRANSITION",
                "El backend no permite devolver una venta confirmada a borrador"
            )
        }
        updated.toDomain()
    }

    /* -------------------------------- Compras ------------------------------- */

    suspend fun getPurchases(): Result<List<Purchase>> = apiResult {
        fetchAllPages { page, limit -> apiService.getPurchases(page, limit) }
            .map { it.toDomain() }
    }

    suspend fun createPurchase(purchase: Purchase): Result<Purchase> = apiResult {
        val warehouse = apiService.defaultWarehouse()
        if (purchase.supplierId.isBlank()) {
            throw ApiException("SUPPLIER_REQUIRED", "Seleccione un proveedor para la compra")
        }
        var created = apiService.createPurchase(
            CreatePurchaseRequestDto(
                supplierId = purchase.supplierId,
                warehouseId = warehouse.id,
                items = purchase.items.map {
                    CreateDocumentItemDto(
                        productId = it.productId,
                        quantity = it.quantity.toDouble(),
                        unitPrice = it.unitPrice
                    )
                }
            )
        ).unwrap()

        if (purchase.status == DocumentStatus.CONFIRMED) {
            created = apiService.confirmPurchase(created.id).unwrap()
        }
        created.toDomain()
    }

    /**
     * Transiciones de compra: CONFIRMED → confirm, COMPLETED → receive
     * (RECIBIDA: el backend descuenta/agrega stock automáticamente), CANCELLED
     * → cancel con motivo. DRAFT no tiene transición inversa en la API.
     */
    suspend fun updatePurchaseStatus(purchaseId: String, status: DocumentStatus): Result<Purchase> = apiResult {
        val updated = when (status) {
            DocumentStatus.CONFIRMED -> apiService.confirmPurchase(purchaseId).unwrap()
            DocumentStatus.COMPLETED -> apiService.receivePurchase(purchaseId).unwrap()
            DocumentStatus.CANCELLED -> apiService.cancelPurchase(
                purchaseId,
                CancelDocumentRequestDto("Cancelado desde la aplicación Android")
            ).unwrap()
            DocumentStatus.DRAFT -> throw ApiException(
                "INVALID_TRANSITION",
                "El backend no permite devolver una compra recibida a borrador"
            )
        }
        updated.toDomain()
    }

    /* ------------------------------- Clientes ------------------------------- */

    suspend fun getCustomers(): Result<List<Customer>> = apiResult {
        val customers = fetchAllPages { page, limit -> apiService.getCustomers(page, limit) }
        // Total comprado = suma de ventas NO canceladas por cliente (dato real).
        val salesByCustomer = try {
            fetchAllPages { page, limit -> apiService.getSales(page, limit) }
                .filter { it.status != "CANCELLED" }
                .filter { it.customerId != null }
                .groupingBy { it.customerId!!.id }
                .fold(0.0) { acc, sale -> acc + sale.total }
        } catch (e: Exception) {
            emptyMap<String, Double>() // sin permiso sales.read → total 0.0
        }
        customers.map { it.toDomain(totalPurchases = salesByCustomer[it.id] ?: 0.0) }
    }

    suspend fun addCustomer(customer: Customer): Result<Customer> = apiResult {
        apiService.createCustomer(customer.toRequest()).unwrap().toDomain()
    }

    suspend fun updateCustomer(customer: Customer): Result<Customer> = apiResult {
        apiService.updateCustomer(customer.id, customer.toRequest()).unwrap().toDomain()
    }

    /* ------------------------------ Proveedores ------------------------------ */

    suspend fun getSuppliers(): Result<List<Supplier>> = apiResult {
        fetchAllPages { page, limit -> apiService.getSuppliers(page, limit) }
            .map { it.toDomain() }
    }

    suspend fun addSupplier(supplier: Supplier): Result<Supplier> = apiResult {
        apiService.createSupplier(supplier.toRequest()).unwrap().toDomain()
    }

    suspend fun updateSupplier(supplier: Supplier): Result<Supplier> = apiResult {
        apiService.updateSupplier(supplier.id, supplier.toRequest()).unwrap().toDomain()
    }

    /* -------------------------------- Internos -------------------------------- */

    private fun Customer.toRequest() = CreateCustomerRequestDto(
        name = name.trim(),
        companyName = company.trim().ifBlank { null },
        email = email.trim().ifBlank { null },
        phone = phone.trim().ifBlank { null },
        address = address.trim().ifBlank { null }
    )

    /** `contactPerson` de la UI se persiste en companyName (el backend no tiene
     *  persona de contacto); `categoriesSupplied` no tiene endpoint → se omite. */
    private fun Supplier.toRequest() = CreateSupplierRequestDto(
        name = name.trim(),
        companyName = contactPerson.trim().ifBlank { null },
        email = email.trim().ifBlank { null },
        phone = phone.trim().ifBlank { null },
        address = address.trim().ifBlank { null }
    )
}
