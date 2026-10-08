package com.codeevo.erp.ui.appshell

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ExitToApp
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.Business
import androidx.compose.material.icons.rounded.Category
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.DarkMode
import androidx.compose.material.icons.rounded.Dashboard
import androidx.compose.material.icons.rounded.Inventory2
import androidx.compose.material.icons.rounded.LightMode
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.SettingsBrightness
import androidx.compose.material.icons.rounded.ShoppingCart
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.PermanentDrawerSheet
import androidx.compose.material3.PermanentNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.codeevo.erp.data.repository.AuthRepository
import com.codeevo.erp.domain.model.Permission
import com.codeevo.erp.domain.model.Role
import com.codeevo.erp.domain.model.User
import com.codeevo.erp.ui.navigation.AuditRoute
import com.codeevo.erp.ui.navigation.CustomersRoute
import com.codeevo.erp.ui.navigation.DashboardRoute
import com.codeevo.erp.ui.navigation.InventoryRoute
import com.codeevo.erp.ui.navigation.NavGroup
import com.codeevo.erp.ui.navigation.NavItem
import com.codeevo.erp.ui.navigation.ProductsRoute
import com.codeevo.erp.ui.navigation.PurchasesRoute
import com.codeevo.erp.ui.navigation.ReportsRoute
import com.codeevo.erp.ui.navigation.SalesRoute
import com.codeevo.erp.ui.navigation.SettingsRoute
import com.codeevo.erp.ui.navigation.SuppliersRoute
import com.codeevo.erp.ui.navigation.UsersRoute
import com.codeevo.erp.ui.navigation.getNavGroupsForUser
import com.codeevo.erp.ui.screens.audit.AuditScreen
import com.codeevo.erp.ui.screens.customers.CustomersScreen
import com.codeevo.erp.ui.screens.dashboard.DashboardScreen
import com.codeevo.erp.ui.screens.inventory.InventoryScreen
import com.codeevo.erp.ui.screens.products.ProductsScreen
import com.codeevo.erp.ui.screens.purchases.PurchasesScreen
import com.codeevo.erp.ui.screens.reports.ReportsScreen
import com.codeevo.erp.ui.screens.sales.SalesScreen
import com.codeevo.erp.ui.screens.settings.SettingsScreen
import com.codeevo.erp.ui.screens.suppliers.SuppliersScreen
import com.codeevo.erp.ui.screens.users.UsersScreen
import com.codeevo.erp.ui.theme.CodeEvoTheme
import com.codeevo.erp.ui.theme.ERPTheme
import com.codeevo.erp.ui.theme.ThemeManager
import com.codeevo.erp.ui.theme.ThemeMode
import kotlinx.coroutines.launch

@Composable
fun AppShell(
    user: User,
    authRepository: AuthRepository,
    themeManager: ThemeManager,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    val themeMode by themeManager.themeMode.collectAsState(initial = ThemeMode.SYSTEM)

    var currentRoute by rememberSaveable { mutableStateOf<Any>(DashboardRoute) }

    val navGroups = remember(user) { getNavGroupsForUser(user) }

    val configuration = LocalConfiguration.current
    val screenWidthDp = configuration.screenWidthDp

    val isMedium = (screenWidthDp >= 600) && (screenWidthDp < 840)
    val isExpanded = screenWidthDp >= 840

    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    val onSelectRoute: (Any) -> Unit = { route ->
        currentRoute = route
        if (drawerState.isOpen) {
            coroutineScope.launch { drawerState.close() }
        }
    }

    val onLogout: () -> Unit = {
        coroutineScope.launch {
            authRepository.logout()
        }
    }

    val onChangeTheme: (ThemeMode) -> Unit = { mode ->
        coroutineScope.launch {
            themeManager.setThemeMode(mode)
        }
    }

    if (isExpanded) {
        PermanentNavigationDrawer(
            drawerContent = {
                PermanentDrawerSheet(
                    modifier = Modifier.width(280.dp),
                    drawerContainerColor = CodeEvoTheme.extraColors.surface2
                ) {
                    AppDrawerHeader(user = user)
                    AppDrawerContent(
                        navGroups = navGroups,
                        currentRoute = currentRoute,
                        onSelectRoute = onSelectRoute
                    )
                }
            },
            modifier = modifier
        ) {
            AppShellScaffold(
                user = user,
                currentRoute = currentRoute,
                themeMode = themeMode,
                onChangeTheme = onChangeTheme,
                onLogout = onLogout,
                onOpenDrawer = null,
                onSelectRoute = onSelectRoute,
                showBottomBar = false
            )
        }
    } else if (isMedium) {
        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ModalDrawerSheet(
                    drawerContainerColor = CodeEvoTheme.extraColors.surface2
                ) {
                    AppDrawerHeader(user = user)
                    AppDrawerContent(
                        navGroups = navGroups,
                        currentRoute = currentRoute,
                        onSelectRoute = onSelectRoute
                    )
                }
            },
            modifier = modifier
        ) {
            Row(modifier = Modifier.fillMaxSize()) {
                AppNavigationRail(
                    navGroups = navGroups,
                    currentRoute = currentRoute,
                    onSelectRoute = onSelectRoute,
                    onOpenDrawer = { coroutineScope.launch { drawerState.open() } }
                )
                AppShellScaffold(
                    user = user,
                    currentRoute = currentRoute,
                    themeMode = themeMode,
                    onChangeTheme = onChangeTheme,
                    onLogout = onLogout,
                    onOpenDrawer = { coroutineScope.launch { drawerState.open() } },
                    onSelectRoute = onSelectRoute,
                    showBottomBar = false,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    } else {
        // Compact (Phone)
        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ModalDrawerSheet(
                    drawerContainerColor = CodeEvoTheme.extraColors.surface2
                ) {
                    AppDrawerHeader(user = user)
                    AppDrawerContent(
                        navGroups = navGroups,
                        currentRoute = currentRoute,
                        onSelectRoute = onSelectRoute
                    )
                }
            },
            modifier = modifier
        ) {
            AppShellScaffold(
                user = user,
                currentRoute = currentRoute,
                themeMode = themeMode,
                onChangeTheme = onChangeTheme,
                onLogout = onLogout,
                onOpenDrawer = { coroutineScope.launch { drawerState.open() } },
                onSelectRoute = onSelectRoute,
                showBottomBar = true
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppShellScaffold(
    user: User,
    currentRoute: Any,
    themeMode: ThemeMode,
    onChangeTheme: (ThemeMode) -> Unit,
    onLogout: () -> Unit,
    onOpenDrawer: (() -> Unit)?,
    onSelectRoute: (Any) -> Unit,
    showBottomBar: Boolean,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            AppTopBar(
                user = user,
                themeMode = themeMode,
                onChangeTheme = onChangeTheme,
                onLogout = onLogout,
                onOpenDrawer = onOpenDrawer
            )
        },
        bottomBar = {
            if (showBottomBar) {
                AppBottomNavigationBar(
                    currentRoute = currentRoute,
                    onSelectRoute = onSelectRoute
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            AnimatedContent(
                targetState = currentRoute,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "ScreenTransition"
            ) { route ->
                when (route) {
                    DashboardRoute -> DashboardScreen(user = user, onNavigateToRoute = onSelectRoute)
                    ProductsRoute -> ProductsScreen(user = user)
                    CustomersRoute -> CustomersScreen(user = user)
                    SuppliersRoute -> SuppliersScreen(user = user)
                    InventoryRoute -> InventoryScreen(user = user)
                    SalesRoute -> SalesScreen(user = user)
                    PurchasesRoute -> PurchasesScreen(user = user)
                    UsersRoute -> UsersScreen(user = user)
                    AuditRoute -> AuditScreen(user = user)
                    ReportsRoute -> ReportsScreen(user = user)
                    SettingsRoute -> SettingsScreen(user = user)
                    else -> DashboardScreen(user = user, onNavigateToRoute = onSelectRoute)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppTopBar(
    user: User,
    themeMode: ThemeMode,
    onChangeTheme: (ThemeMode) -> Unit,
    onLogout: () -> Unit,
    onOpenDrawer: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    var showCompanyMenu by remember { mutableStateOf(false) }
    var showThemeMenu by remember { mutableStateOf(false) }
    var showUserMenu by remember { mutableStateOf(false) }

    // Empresa real del token: una sesión pertenece a UNA empresa (multiempresa
    // por JWT), así que el selector muestra la empresa del usuario autenticado.
    val companyNames = remember(user.companyName) { listOf(user.companyName.ifBlank { "Mi Empresa" }) }
    var selectedCompany by remember(companyNames) { mutableStateOf(companyNames.first()) }

    TopAppBar(
        modifier = modifier,
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = CodeEvoTheme.extraColors.surface2,
            titleContentColor = CodeEvoTheme.extraColors.textPrimary
        ),
        navigationIcon = {
            if (onOpenDrawer != null) {
                IconButton(onClick = onOpenDrawer) {
                    Icon(
                        imageVector = Icons.Rounded.Menu,
                        contentDescription = "Abrir menú",
                        tint = CodeEvoTheme.extraColors.textPrimary
                    )
                }
            } else {
                Box(
                    modifier = Modifier
                        .padding(start = 16.dp, end = 8.dp)
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(
                            brush = Brush.linearGradient(
                                listOf(
                                    CodeEvoTheme.extraColors.primaryBlue,
                                    CodeEvoTheme.extraColors.cyan
                                )
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Business,
                        contentDescription = "CodeEvo",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        },
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "CodeEvo ERP",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = CodeEvoTheme.extraColors.textPrimary
                )

                Spacer(modifier = Modifier.width(16.dp))

                // Company Selector Chip
                Box {
                    Surface(
                        onClick = { showCompanyMenu = true },
                        shape = RoundedCornerShape(20.dp),
                        color = CodeEvoTheme.extraColors.border.copy(alpha = 0.4f),
                        modifier = Modifier.clip(RoundedCornerShape(20.dp))
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Business,
                                contentDescription = null,
                                tint = CodeEvoTheme.extraColors.cyan,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = selectedCompany,
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium),
                                color = CodeEvoTheme.extraColors.textPrimary
                            )
                            Icon(
                                imageVector = Icons.Rounded.ArrowDropDown,
                                contentDescription = "Cambiar empresa",
                                tint = CodeEvoTheme.extraColors.textSecondary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    DropdownMenu(
                        expanded = showCompanyMenu,
                        onDismissRequest = { showCompanyMenu = false }
                    ) {
                        companyNames.forEach { company ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = company,
                                        fontWeight = if (company == selectedCompany) FontWeight.Bold else FontWeight.Normal
                                    )
                                },
                                leadingIcon = {
                                    if (company == selectedCompany) {
                                        Icon(
                                            imageVector = Icons.Rounded.Check,
                                            contentDescription = null,
                                            tint = CodeEvoTheme.extraColors.primaryBlue
                                        )
                                    }
                                },
                                onClick = {
                                    selectedCompany = company
                                    showCompanyMenu = false
                                }
                            )
                        }
                    }
                }
            }
        },
        actions = {
            // Theme Menu Toggle
            Box {
                IconButton(onClick = { showThemeMenu = true }) {
                    Icon(
                        imageVector = when (themeMode) {
                            ThemeMode.LIGHT -> Icons.Rounded.LightMode
                            ThemeMode.DARK -> Icons.Rounded.DarkMode
                            ThemeMode.SYSTEM -> Icons.Rounded.SettingsBrightness
                        },
                        contentDescription = "Cambiar tema",
                        tint = CodeEvoTheme.extraColors.textPrimary
                    )
                }

                DropdownMenu(
                    expanded = showThemeMenu,
                    onDismissRequest = { showThemeMenu = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("Claro") },
                        leadingIcon = { Icon(Icons.Rounded.LightMode, contentDescription = null) },
                        onClick = {
                            onChangeTheme(ThemeMode.LIGHT)
                            showThemeMenu = false
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("Oscuro") },
                        leadingIcon = { Icon(Icons.Rounded.DarkMode, contentDescription = null) },
                        onClick = {
                            onChangeTheme(ThemeMode.DARK)
                            showThemeMenu = false
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("Sistema") },
                        leadingIcon = { Icon(Icons.Rounded.SettingsBrightness, contentDescription = null) },
                        onClick = {
                            onChangeTheme(ThemeMode.SYSTEM)
                            showThemeMenu = false
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.width(4.dp))

            // User Profile Avatar & Logout Action
            Box {
                Surface(
                    onClick = { showUserMenu = true },
                    shape = CircleShape,
                    color = CodeEvoTheme.extraColors.primaryBlue
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .padding(2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = user.name.take(2).uppercase(),
                            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                            color = Color.White
                        )
                    }
                }

                DropdownMenu(
                    expanded = showUserMenu,
                    onDismissRequest = { showUserMenu = false }
                ) {
                    Box(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
                    ) {
                        Column {
                            Text(
                                text = user.name,
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                color = CodeEvoTheme.extraColors.textPrimary
                            )
                            Text(
                                text = user.email,
                                style = MaterialTheme.typography.bodySmall,
                                color = CodeEvoTheme.extraColors.textSecondary
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = CodeEvoTheme.extraColors.primaryBlue.copy(alpha = 0.15f)
                            ) {
                                Text(
                                    text = user.roleName.ifBlank { user.role.name },
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                                    color = CodeEvoTheme.extraColors.primaryBlue,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }

                    DropdownMenuItem(
                        text = { Text("Cerrar Sesión", color = CodeEvoTheme.extraColors.danger) },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.AutoMirrored.Rounded.ExitToApp,
                                contentDescription = "Cerrar sesión",
                                tint = CodeEvoTheme.extraColors.danger
                            )
                        },
                        onClick = {
                            showUserMenu = false
                            onLogout()
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))
        }
    )
}

@Composable
private fun AppDrawerHeader(user: User) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(CodeEvoTheme.extraColors.surface2)
            .padding(20.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(
                        brush = Brush.linearGradient(
                            listOf(
                                CodeEvoTheme.extraColors.primaryBlue,
                                CodeEvoTheme.extraColors.cyan
                            )
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = user.name.take(2).uppercase(),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = user.name,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = CodeEvoTheme.extraColors.textPrimary
                )
                Text(
                    text = user.email,
                    style = MaterialTheme.typography.labelMedium,
                    color = CodeEvoTheme.extraColors.textSecondary
                )
            }
        }
    }
}

@Composable
private fun AppDrawerContent(
    navGroups: List<NavGroup>,
    currentRoute: Any,
    onSelectRoute: (Any) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(vertical = 12.dp, horizontal = 12.dp)
    ) {
        navGroups.forEach { group ->
            Text(
                text = group.title,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                ),
                color = CodeEvoTheme.extraColors.textSecondary.copy(alpha = 0.8f),
                modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp)
            )

            group.items.forEach { item ->
                val isSelected = currentRoute == item.route
                NavigationDrawerItem(
                    label = {
                        Text(
                            text = item.title,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        )
                    },
                    icon = {
                        Icon(
                            imageVector = item.icon,
                            contentDescription = item.title,
                            tint = if (isSelected) CodeEvoTheme.extraColors.primaryBlue else CodeEvoTheme.extraColors.textSecondary
                        )
                    },
                    selected = isSelected,
                    onClick = { onSelectRoute(item.route) },
                    shape = RoundedCornerShape(12.dp),
                    colors = NavigationDrawerItemDefaults.colors(
                        selectedContainerColor = CodeEvoTheme.extraColors.primaryBlue.copy(alpha = 0.15f),
                        selectedIconColor = CodeEvoTheme.extraColors.primaryBlue,
                        selectedTextColor = CodeEvoTheme.extraColors.primaryBlue,
                        unselectedContainerColor = Color.Transparent,
                        unselectedIconColor = CodeEvoTheme.extraColors.textSecondary,
                        unselectedTextColor = CodeEvoTheme.extraColors.textPrimary
                    ),
                    modifier = Modifier.padding(vertical = 2.dp)
                )
            }
        }
    }
}

@Composable
private fun AppNavigationRail(
    navGroups: List<NavGroup>,
    currentRoute: Any,
    onSelectRoute: (Any) -> Unit,
    onOpenDrawer: () -> Unit
) {
    val topItems = remember(navGroups) {
        navGroups.flatMap { it.items }.take(6)
    }

    NavigationRail(
        containerColor = CodeEvoTheme.extraColors.surface2,
        header = {
            IconButton(onClick = onOpenDrawer, modifier = Modifier.padding(vertical = 8.dp)) {
                Icon(
                    imageVector = Icons.Rounded.Menu,
                    contentDescription = "Abrir menú completo",
                    tint = CodeEvoTheme.extraColors.textPrimary
                )
            }
        }
    ) {
        Spacer(modifier = Modifier.height(8.dp))
        topItems.forEach { item ->
            val isSelected = currentRoute == item.route
            NavigationRailItem(
                selected = isSelected,
                onClick = { onSelectRoute(item.route) },
                icon = {
                    Icon(
                        imageVector = item.icon,
                        contentDescription = item.title
                    )
                },
                label = {
                    Text(
                        text = item.title,
                        maxLines = 1
                    )
                },
                colors = NavigationRailItemDefaults.colors(
                    selectedIconColor = CodeEvoTheme.extraColors.primaryBlue,
                    selectedTextColor = CodeEvoTheme.extraColors.primaryBlue,
                    indicatorColor = CodeEvoTheme.extraColors.primaryBlue.copy(alpha = 0.15f),
                    unselectedIconColor = CodeEvoTheme.extraColors.textSecondary,
                    unselectedTextColor = CodeEvoTheme.extraColors.textSecondary
                )
            )
        }
    }
}

@Composable
private fun AppBottomNavigationBar(
    currentRoute: Any,
    onSelectRoute: (Any) -> Unit
) {
    val quickItems = listOf(
        NavItem("Dashboard", DashboardRoute, Icons.Rounded.Dashboard),
        NavItem("Ventas", SalesRoute, Icons.Rounded.ShoppingCart),
        NavItem("Inventario", InventoryRoute, Icons.Rounded.Inventory2),
        NavItem("Productos", ProductsRoute, Icons.Rounded.Category),
        NavItem("Ajustes", SettingsRoute, Icons.Rounded.Settings)
    )

    NavigationBar(
        containerColor = CodeEvoTheme.extraColors.surface2
    ) {
        quickItems.forEach { item ->
            val isSelected = currentRoute == item.route
            NavigationBarItem(
                selected = isSelected,
                onClick = { onSelectRoute(item.route) },
                icon = {
                    Icon(
                        imageVector = item.icon,
                        contentDescription = item.title
                    )
                },
                label = {
                    Text(
                        text = item.title,
                        maxLines = 1,
                        style = MaterialTheme.typography.labelSmall
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = CodeEvoTheme.extraColors.primaryBlue,
                    selectedTextColor = CodeEvoTheme.extraColors.primaryBlue,
                    indicatorColor = CodeEvoTheme.extraColors.primaryBlue.copy(alpha = 0.15f),
                    unselectedIconColor = CodeEvoTheme.extraColors.textSecondary,
                    unselectedTextColor = CodeEvoTheme.extraColors.textSecondary
                )
            )
        }
    }
}

@Preview(name = "AppShell Light Preview", showBackground = true)
@Composable
fun AppShellLightPreview() {
    val sampleUser = User(
        id = "usr_001",
        firstName = "Alex",
        lastName = "Vance",
        email = "admin@codeevo.com",
        roleName = "Administrador",
        role = Role.ADMIN,
        permissions = Permission.entries
    )

    ERPTheme(darkTheme = false) {
        Surface {
            AppDrawerHeader(user = sampleUser)
        }
    }
}
