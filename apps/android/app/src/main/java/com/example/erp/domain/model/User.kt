package com.example.erp.domain.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class User(
    val id: String,
    val name: String,
    val email: String,
    val role: Role,
    val permissions: List<Permission> = emptyList(),
    val avatarUrl: String? = null
)

fun User.hasPermission(permission: Permission?): Boolean {
    if (permission == null) return true
    if (this.role == Role.ADMIN) return true
    return this.permissions.contains(permission)
}

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String
)

@JsonClass(generateAdapter = true)
data class LoginResponse(
    val token: String,
    val refreshToken: String? = null,
    val user: User
)
