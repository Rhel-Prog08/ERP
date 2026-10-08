package com.codeevo.erp.ui.screens.users

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.codeevo.erp.data.repository.UserRepository
import com.codeevo.erp.domain.model.Permission
import com.codeevo.erp.domain.model.User
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface UsersUiState {
    data object Loading : UsersUiState
    data class Content(
        val users: List<User>,
        val filteredUsers: List<User>,
        val searchQuery: String = ""
    ) : UsersUiState
    data class Error(val message: String) : UsersUiState
}

class UsersViewModel(
    private val userRepository: UserRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<UsersUiState>(UsersUiState.Loading)
    val uiState: StateFlow<UsersUiState> = _uiState.asStateFlow()

    init {
        loadUsers()
    }

    fun loadUsers() {
        viewModelScope.launch {
            _uiState.value = UsersUiState.Loading
            try {
                val res = userRepository.getUsers()
                val list = res.getOrDefault(emptyList())
                val state = UsersUiState.Content(
                    users = list,
                    filteredUsers = list
                )
                _uiState.value = filterUsers(state)
            } catch (e: Exception) {
                _uiState.value = UsersUiState.Error(e.message ?: "Error al cargar usuarios")
            }
        }
    }

    fun setSearchQuery(query: String) {
        val current = _uiState.value as? UsersUiState.Content ?: return
        _uiState.value = filterUsers(current.copy(searchQuery = query))
    }

    fun addUser(input: UserRepository.CreateUserInput) {
        viewModelScope.launch {
            userRepository.addUser(input).fold(
                onSuccess = { loadUsers() },
                onFailure = { e ->
                    _uiState.value = UsersUiState.Error(e.message ?: "No se pudo crear el usuario")
                }
            )
        }
    }

    fun togglePermission(userId: String, permission: Permission) {
        val current = _uiState.value as? UsersUiState.Content ?: return
        val user = current.users.firstOrNull { it.id == userId } ?: return
        val newPermissions = if (user.permissions.contains(permission)) {
            user.permissions - permission
        } else {
            user.permissions + permission
        }
        val updatedUser = user.copy(permissions = newPermissions)
        viewModelScope.launch {
            // Persiste los toggles sobre el ROL del usuario (PATCH /roles/:id);
            // si el backend los rechaza (p.ej. rol propio) se muestra el error real.
            userRepository.updateUser(updatedUser).fold(
                onSuccess = { loadUsers() },
                onFailure = { e ->
                    _uiState.value = UsersUiState.Error(e.message ?: "No se pudieron actualizar los permisos")
                }
            )
        }
    }

    private fun filterUsers(state: UsersUiState.Content): UsersUiState.Content {
        val filtered = if (state.searchQuery.isBlank()) {
            state.users
        } else {
            state.users.filter { u ->
                u.name.contains(state.searchQuery, ignoreCase = true) ||
                        u.email.contains(state.searchQuery, ignoreCase = true) ||
                        u.roleName.contains(state.searchQuery, ignoreCase = true) ||
                        u.role.name.contains(state.searchQuery, ignoreCase = true)
            }
        }
        return state.copy(filteredUsers = filtered)
    }

    class Factory(private val userRepository: UserRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return UsersViewModel(userRepository) as T
        }
    }
}
