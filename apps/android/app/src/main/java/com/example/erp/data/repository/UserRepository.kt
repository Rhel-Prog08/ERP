package com.example.erp.data.repository

import com.example.erp.data.network.ErpApiService
import com.example.erp.domain.model.Permission
import com.example.erp.domain.model.Role
import com.example.erp.domain.model.User

class UserRepository(
    private val apiService: ErpApiService
) {
    private val inMemoryUsers = mockUsers.toMutableList()

    suspend fun getUsers(): Result<List<User>> {
        return Result.success(inMemoryUsers)
    }

    suspend fun addUser(user: User): Result<User> {
        inMemoryUsers.add(0, user)
        return Result.success(user)
    }

    suspend fun updateUser(user: User): Result<User> {
        val index = inMemoryUsers.indexOfFirst { it.id == user.id }
        if (index != -1) {
            inMemoryUsers[index] = user
        }
        return Result.success(user)
    }

    companion object {
        val mockUsers = listOf(
            User(
                id = "usr_001",
                name = "Alex Vance",
                email = "admin@codeevo.com",
                role = Role.ADMIN,
                permissions = Permission.entries
            ),
            User(
                id = "usr_002",
                name = "Sarah Connor",
                email = "sarah.c@codeevo.com",
                role = Role.MANAGER,
                permissions = listOf(
                    Permission.READ_PRODUCTS, Permission.WRITE_PRODUCTS,
                    Permission.READ_SALES, Permission.WRITE_SALES,
                    Permission.READ_PURCHASES, Permission.WRITE_PURCHASES,
                    Permission.MANAGE_INVENTORY, Permission.VIEW_FINANCES
                )
            ),
            User(
                id = "usr_003",
                name = "David Chen",
                email = "d.chen@codeevo.com",
                role = Role.SALES,
                permissions = listOf(
                    Permission.READ_PRODUCTS,
                    Permission.READ_SALES, Permission.WRITE_SALES
                )
            ),
            User(
                id = "usr_004",
                name = "Maria Rodriguez",
                email = "m.rodriguez@codeevo.com",
                role = Role.INVENTORY,
                permissions = listOf(
                    Permission.READ_PRODUCTS,
                    Permission.MANAGE_INVENTORY
                )
            ),
            User(
                id = "usr_005",
                name = "Carlos Gomez",
                email = "c.gomez@codeevo.com",
                role = Role.FINANCE,
                permissions = listOf(
                    Permission.READ_SALES, Permission.READ_PURCHASES, Permission.VIEW_FINANCES
                )
            )
        )
    }
}
