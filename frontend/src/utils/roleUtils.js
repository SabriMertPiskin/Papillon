/**
 * Role-based access utilities for Papillon
 * Roles: 'admin', 'analyst'
 */

export const getRoleFromStorage = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.role || null;
};

export const canEditAnalysis = () => {
  const role = getRoleFromStorage();
  return role === 'admin' || role === 'analyst';
};

export const canManageVM = () => {
  const role = getRoleFromStorage();
  return role === 'admin' || role === 'analyst';
};

export const canAccessAdminPanel = () => {
  const role = getRoleFromStorage();
  return role === 'admin';
};

export const canExportData = () => {
  const role = getRoleFromStorage();
  return role === 'admin' || role === 'analyst';
};

export const isAdmin = () => {
  return getRoleFromStorage() === 'admin';
};

export const isAnalyst = () => {
  return getRoleFromStorage() === 'analyst';
};
