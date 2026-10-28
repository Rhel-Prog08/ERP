export function activeRoles(roles) {
  return roles.filter((role) => role.status === 'active');
}

export function roleAvailability(roles, roleId) {
  const role = roles.find((item) => item._id === roleId);
  return role ? role.status : 'missing';
}

export async function loadRoleCatalog(fetchRoles, getErrorMessage) {
  try {
    return { roles: await fetchRoles(), error: null };
  } catch (error) {
    return { roles: [], error: getErrorMessage(error) };
  }
}
