package com.example.erp.data.network

import com.example.erp.domain.model.*
import retrofit2.Response
import retrofit2.http.*

interface ErpApiService {

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>

    @GET("api/auth/me")
    suspend fun getCurrentUser(): Response<User>

    @GET("api/dashboard/kpis")
    suspend fun getDashboardKpis(): Response<DashboardKpis>

    @GET("api/dashboard/audit-logs")
    suspend fun getAuditLogs(): Response<List<AuditLog>>

    @GET("api/products")
    suspend fun getProducts(): Response<List<Product>>

    @GET("api/products/{id}")
    suspend fun getProductById(@Path("id") id: String): Response<Product>

    @POST("api/products")
    suspend fun createProduct(@Body product: Product): Response<Product>

    @PUT("api/products/{id}")
    suspend fun updateProduct(@Path("id") id: String, @Body product: Product): Response<Product>

    @GET("api/inventory")
    suspend fun getInventoryItems(): Response<List<InventoryItem>>

    @GET("api/sales")
    suspend fun getSales(): Response<List<Sale>>

    @POST("api/sales")
    suspend fun createSale(@Body sale: Sale): Response<Sale>

    @GET("api/purchases")
    suspend fun getPurchases(): Response<List<Purchase>>

    @POST("api/purchases")
    suspend fun createPurchase(@Body purchase: Purchase): Response<Purchase>

    @GET("api/customers")
    suspend fun getCustomers(): Response<List<Customer>>

    @GET("api/suppliers")
    suspend fun getSuppliers(): Response<List<Supplier>>
}
