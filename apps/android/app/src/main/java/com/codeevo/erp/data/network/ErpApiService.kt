package com.codeevo.erp.data.network

import com.codeevo.erp.data.dto.AuthSessionDto
import com.codeevo.erp.data.dto.AuditItemDto
import com.codeevo.erp.data.dto.BalanceDto
import com.codeevo.erp.data.dto.CancelDocumentRequestDto
import com.codeevo.erp.data.dto.CategoryDto
import com.codeevo.erp.data.dto.CompanyDto
import com.codeevo.erp.data.dto.CreateCustomerRequestDto
import com.codeevo.erp.data.dto.CreateMovementRequestDto
import com.codeevo.erp.data.dto.CreateProductRequestDto
import com.codeevo.erp.data.dto.CreatePurchaseRequestDto
import com.codeevo.erp.data.dto.CreateSaleRequestDto
import com.codeevo.erp.data.dto.CreateSupplierRequestDto
import com.codeevo.erp.data.dto.CreateUserRequestDto
import com.codeevo.erp.data.dto.CustomerDto
import com.codeevo.erp.data.dto.DashboardDto
import com.codeevo.erp.data.dto.LoginRequestDto
import com.codeevo.erp.data.dto.LogoutRequestDto
import com.codeevo.erp.data.dto.LogoutResponseDto
import com.codeevo.erp.data.dto.MovementDto
import com.codeevo.erp.data.dto.PagedDto
import com.codeevo.erp.data.dto.ProductDto
import com.codeevo.erp.data.dto.PurchaseDto
import com.codeevo.erp.data.dto.RefreshTokenRequestDto
import com.codeevo.erp.data.dto.ReportEnvelopeDto
import com.codeevo.erp.data.dto.RoleDto
import com.codeevo.erp.data.dto.RoleUpdateRequestDto
import com.codeevo.erp.data.dto.SaleDto
import com.codeevo.erp.data.dto.SettingsDto
import com.codeevo.erp.data.dto.SupplierDto
import com.codeevo.erp.data.dto.UpdateCompanyRequestDto
import com.codeevo.erp.data.dto.UpdateProductRequestDto
import com.codeevo.erp.data.dto.UpdateSettingsRequestDto
import com.codeevo.erp.data.dto.UpdateUserRequestDto
import com.codeevo.erp.data.dto.UserDto
import com.codeevo.erp.data.dto.UserListItemDto
import com.codeevo.erp.data.dto.WarehouseDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * API del backend CodeEvo (https://erp-eatk.onrender.com/api/v1/).
 *
 * IMPORTANTE: [ApiClient.BASE_URL] ya incluye `/api/v1/`, por lo que las rutas
 * aquí NO llevan prefijo `api/`. Todas las respuestas usan el sobre
 * { success, data } → se parsean como [ApiEnvelope] y se desempaquetan con
 * `unwrap()` en los repositorios.
 */
interface ErpApiService {

    /* --------------------------------- Auth -------------------------------- */

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequestDto): Response<ApiEnvelope<AuthSessionDto>>

    @POST("auth/refresh")
    suspend fun refresh(@Body request: RefreshTokenRequestDto): Response<ApiEnvelope<AuthSessionDto>>

    @POST("auth/logout")
    suspend fun logout(@Body request: LogoutRequestDto): Response<ApiEnvelope<LogoutResponseDto>>

    @GET("auth/me")
    suspend fun getCurrentUser(): Response<ApiEnvelope<UserDto>>

    /* ------------------------------- Dashboard ----------------------------- */

    @GET("dashboard")
    suspend fun getDashboard(): Response<ApiEnvelope<DashboardDto>>

    /* ------------------------------- Auditoría ----------------------------- */

    @GET("audit")
    suspend fun getAuditLogs(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null
    ): Response<ApiEnvelope<PagedDto<AuditItemDto>>>

    /* -------------------------------- Productos ---------------------------- */

    @GET("products")
    suspend fun getProducts(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null,
        @Query("q") q: String? = null,
        @Query("status") status: String? = null
    ): Response<ApiEnvelope<PagedDto<ProductDto>>>

    @GET("products/{id}")
    suspend fun getProduct(@Path("id") id: String): Response<ApiEnvelope<ProductDto>>

    @POST("products")
    suspend fun createProduct(@Body body: CreateProductRequestDto): Response<ApiEnvelope<ProductDto>>

    @PATCH("products/{id}")
    suspend fun updateProduct(
        @Path("id") id: String,
        @Body body: UpdateProductRequestDto
    ): Response<ApiEnvelope<ProductDto>>

    /* ------------------------- Categorías y Almacenes ---------------------- */

    @GET("categories")
    suspend fun getCategories(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null
    ): Response<ApiEnvelope<PagedDto<CategoryDto>>>

    @GET("warehouses")
    suspend fun getWarehouses(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null,
        @Query("status") status: String? = null
    ): Response<ApiEnvelope<PagedDto<WarehouseDto>>>

    /* ------------------------------- Inventario ---------------------------- */

    @GET("inventory")
    suspend fun getInventory(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null,
        @Query("lowStock") lowStock: Boolean? = null
    ): Response<ApiEnvelope<PagedDto<BalanceDto>>>

    @GET("inventory/movements")
    suspend fun getMovements(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null
    ): Response<ApiEnvelope<PagedDto<MovementDto>>>

    @POST("inventory/movements")
    suspend fun createMovement(@Body body: CreateMovementRequestDto): Response<ApiEnvelope<MovementDto>>

    /* --------------------------- Clientes/Proveedores ---------------------- */

    @GET("customers")
    suspend fun getCustomers(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null,
        @Query("q") q: String? = null
    ): Response<ApiEnvelope<PagedDto<CustomerDto>>>

    @POST("customers")
    suspend fun createCustomer(@Body body: CreateCustomerRequestDto): Response<ApiEnvelope<CustomerDto>>

    @PATCH("customers/{id}")
    suspend fun updateCustomer(
        @Path("id") id: String,
        @Body body: CreateCustomerRequestDto
    ): Response<ApiEnvelope<CustomerDto>>

    @GET("suppliers")
    suspend fun getSuppliers(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null,
        @Query("q") q: String? = null
    ): Response<ApiEnvelope<PagedDto<SupplierDto>>>

    @POST("suppliers")
    suspend fun createSupplier(@Body body: CreateSupplierRequestDto): Response<ApiEnvelope<SupplierDto>>

    @PATCH("suppliers/{id}")
    suspend fun updateSupplier(
        @Path("id") id: String,
        @Body body: CreateSupplierRequestDto
    ): Response<ApiEnvelope<SupplierDto>>

    /* --------------------------------- Ventas ------------------------------ */

    @GET("sales")
    suspend fun getSales(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null,
        @Query("status") status: String? = null
    ): Response<ApiEnvelope<PagedDto<SaleDto>>>

    @POST("sales")
    suspend fun createSale(@Body body: CreateSaleRequestDto): Response<ApiEnvelope<SaleDto>>

    @POST("sales/{id}/confirm")
    suspend fun confirmSale(@Path("id") id: String): Response<ApiEnvelope<SaleDto>>

    @POST("sales/{id}/complete")
    suspend fun completeSale(@Path("id") id: String): Response<ApiEnvelope<SaleDto>>

    @POST("sales/{id}/cancel")
    suspend fun cancelSale(
        @Path("id") id: String,
        @Body body: CancelDocumentRequestDto
    ): Response<ApiEnvelope<SaleDto>>

    /* -------------------------------- Compras ------------------------------ */

    @GET("purchases")
    suspend fun getPurchases(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null,
        @Query("status") status: String? = null
    ): Response<ApiEnvelope<PagedDto<PurchaseDto>>>

    @POST("purchases")
    suspend fun createPurchase(@Body body: CreatePurchaseRequestDto): Response<ApiEnvelope<PurchaseDto>>

    @POST("purchases/{id}/confirm")
    suspend fun confirmPurchase(@Path("id") id: String): Response<ApiEnvelope<PurchaseDto>>

    @POST("purchases/{id}/receive")
    suspend fun receivePurchase(@Path("id") id: String): Response<ApiEnvelope<PurchaseDto>>

    @POST("purchases/{id}/cancel")
    suspend fun cancelPurchase(
        @Path("id") id: String,
        @Body body: CancelDocumentRequestDto
    ): Response<ApiEnvelope<PurchaseDto>>

    /* ------------------------------ Usuarios ------------------------------- */

    @GET("users")
    suspend fun getUsers(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null,
        @Query("q") q: String? = null
    ): Response<ApiEnvelope<PagedDto<UserListItemDto>>>

    @POST("users")
    suspend fun createUser(@Body body: CreateUserRequestDto): Response<ApiEnvelope<UserListItemDto>>

    @PATCH("users/{id}")
    suspend fun updateUser(
        @Path("id") id: String,
        @Body body: UpdateUserRequestDto
    ): Response<ApiEnvelope<UserListItemDto>>

    /* --------------------------------- Roles -------------------------------- */

    @GET("roles")
    suspend fun getRoles(): Response<ApiEnvelope<List<RoleDto>>>

    @PATCH("roles/{id}")
    suspend fun updateRole(
        @Path("id") id: String,
        @Body body: RoleUpdateRequestDto
    ): Response<ApiEnvelope<RoleDto>>

    /* --------------------------- Empresa / Ajustes -------------------------- */

    @GET("companies")
    suspend fun getCompany(): Response<ApiEnvelope<CompanyDto>>

    @PATCH("companies/{id}")
    suspend fun updateCompany(
        @Path("id") id: String,
        @Body body: UpdateCompanyRequestDto
    ): Response<ApiEnvelope<CompanyDto>>

    @GET("settings")
    suspend fun getSettings(): Response<ApiEnvelope<SettingsDto>>

    @PATCH("settings")
    suspend fun updateSettings(@Body body: UpdateSettingsRequestDto): Response<ApiEnvelope<SettingsDto>>

    /* ------------------------------- Reportes ------------------------------- */

    @GET("reports/sales")
    suspend fun getSalesReport(
        @Query("dateFrom") dateFrom: String? = null,
        @Query("dateTo") dateTo: String? = null
    ): Response<ApiEnvelope<ReportEnvelopeDto>>

    @GET("reports/purchases")
    suspend fun getPurchasesReport(
        @Query("dateFrom") dateFrom: String? = null,
        @Query("dateTo") dateTo: String? = null
    ): Response<ApiEnvelope<ReportEnvelopeDto>>
}
