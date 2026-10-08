package com.codeevo.erp.data.repository

import com.codeevo.erp.data.dto.CreateUserRequestDto
import com.codeevo.erp.data.dto.RoleDto
import com.codeevo.erp.data.dto.UpdateUserRequestDto
import com.codeevo.erp.data.dto.RoleUpdateRequestDto
import com.codeevo.erp.data.mapper.toDomain
import com.codeevo.erp.data.network.ApiException
import com.codeevo.erp.data.network.ErpApiService
import com.codeevo.erp.data.network.unwrap
import com.codeevo.erp.domain.model.Role
import com.codeevo.erp.domain.model.User
import com.codeevo.erp.domain.model.applyPermissionToggles
import com.codeevo.erp.domain.model.toBackendName

/**
 * Usuarios reales de GET/POST/PATCH /users + roles de GET /roles.
 *
 * El backend modela permisos por ROL (usuario → rol → permissions[]), así que
 * la matriz RBAC de la UI persiste los toggles en PATCH /roles/:id
 * conservando las claves reales que no tienen equivalente en el enum.
 */
class UserRepository(
    private val apiService: ErpApiService
) {

    /** Entrada del diálogo de alta (el backend exige password y roleId). */
    data class CreateUserInput(
        val fullName: String,
        val email: String,
        val password: String,
        val role: Role
    )

    suspend fun getUsers(): Result<List<User>> = apiResult {
        val rolesById = fetchRoles().associateBy { it.id }
        fetchAllPages { page, limit -> apiService.getUsers(page, limit) }
            .map { it.toDomain(rolesById) }
    }

    suspend fun addUser(input: CreateUserInput): Result<User> = apiResult {
        val roles = fetchRoles()
        val roleDto = roles.firstOrNull { it.name.equals(input.role.toBackendName(), ignoreCase = true) }
            ?: throw ApiException("ROLE_NOT_FOUND", "El rol \"${input.role.toBackendName()}\" no existe en la empresa")

        val parts = input.fullName.trim().split(Regex("\\s+"))
        if (parts.isEmpty() || parts.first().isBlank()) {
            throw ApiException("NAME_REQUIRED", "Escriba el nombre completo del usuario")
        }
        if (input.password.length < 8) {
            throw ApiException("WEAK_PASSWORD", "La contraseña debe tener al menos 8 caracteres")
        }

        val created = apiService.createUser(
            CreateUserRequestDto(
                firstName = parts.first(),
                lastName = parts.getOrNull(1) ?: parts.first(),
                email = input.email.trim(),
                password = input.password,
                roleId = roleDto.id
            )
        ).unwrap()

        created.toDomain(roles.associateBy { it.id })
    }

    /**
     * Actualiza perfil (PATCH /users/:id) y, si cambiaron los toggles de la
     * matriz de permisos, los persiste sobre el ROL del usuario
     * (PATCH /roles/:id) sin perder claves ajenas al enum.
     */
    suspend fun updateUser(user: User): Result<User> = apiResult {
        val roles = fetchRoles()
        val rolesById = roles.associateBy { it.id }

        val newRawPermissions = applyPermissionToggles(user.rawPermissions, user.permissions)
        if (newRawPermissions != user.rawPermissions) {
            if (user.roleId.isBlank()) {
                throw ApiException("ROLE_NOT_FOUND", "El usuario no tiene rol asignado")
            }
            val role = rolesById[user.roleId]
                ?: throw ApiException("ROLE_NOT_FOUND", "El rol del usuario ya no existe")
            if (role.permissions != newRawPermissions) {
                apiService.updateRole(role.id, RoleUpdateRequestDto(permissions = newRawPermissions)).unwrap()
            }
        }

        val updated = apiService.updateUser(
            user.id,
            UpdateUserRequestDto(
                firstName = user.firstName.ifBlank { null },
                lastName = user.lastName.ifBlank { null },
                email = user.email.trim(),
                status = user.status.takeIf { it == "active" || it == "inactive" }
            )
        ).unwrap()

        updated.toDomain(rolesById)
    }

    private suspend fun fetchRoles(): List<RoleDto> = apiService.getRoles().unwrap()
}
