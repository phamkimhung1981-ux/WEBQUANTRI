import { useMemo } from 'react';
import { useAuth } from '../store/AuthContext';
import {
  ModuleCode,
  PermissionAction,
  RoleGroupCode,
  DEFAULT_ROLE_GROUPS,
  ModuleActionPermissions,
  SYSTEM_MODULES_LIST,
  normalizeIdentifier
} from '../types/permission';
import { detectRoleGroupByPosition } from '../services/accountService';

export function usePermission() {
  const { user, permissionsReady, permissionsVersion, permissionSyncError } = useAuth();

  // True system administrator ONLY (admin user account)
  const isSystemAdmin = useMemo(() => {
    if (!user) return false;
    const cleanUser = normalizeIdentifier(user.username || user.id);
    return cleanUser === 'admin' || user.role === 'admin' || user.role === 'ADMIN' || user.roleGroup === 'ADMIN';
  }, [user]);

  // Determine user's effective role group from authoritative Firestore user state
  const roleGroup: RoleGroupCode = useMemo(() => {
    if (!user) return 'TEACHER';
    const cleanUser = normalizeIdentifier(user.username || user.id);
    if (cleanUser === 'admin' || user.role === 'admin' || user.role === 'ADMIN' || user.roleGroup === 'ADMIN') {
      return 'ADMIN';
    }
    const anyUser = user as any;
    if (anyUser.roleGroup && DEFAULT_ROLE_GROUPS[anyUser.roleGroup as RoleGroupCode]) {
      return anyUser.roleGroup as RoleGroupCode;
    }
    if (anyUser.accountRole && DEFAULT_ROLE_GROUPS[anyUser.accountRole as RoleGroupCode]) {
      return anyUser.accountRole as RoleGroupCode;
    }
    if (user.role === 'BGH') return 'BGH';
    if (user.role === 'TTCM') return 'TTCM';

    return detectRoleGroupByPosition(user.position, user.departmentId);
  }, [user]);

  // Compute effective permissions strictly from Firestore-backed user state + Firestore-backed DEFAULT_ROLE_GROUPS.
  // ZERO localStorage or static JSON reads.
  const effectivePermissions = useMemo(() => {
    const hasCustom = Boolean(
      user?.hasCustomPermissions &&
        user?.customPermissions &&
        Object.keys(user.customPermissions).length > 0
    );
    const customPerms = hasCustom
      ? (user?.customPermissions as Partial<Record<ModuleCode, ModuleActionPermissions>>)
      : undefined;

    const baseConfig = DEFAULT_ROLE_GROUPS[roleGroup] || DEFAULT_ROLE_GROUPS.TEACHER;
    const basePermissions = baseConfig.permissions;

    const result: Record<ModuleCode, ModuleActionPermissions> = {} as any;

    SYSTEM_MODULES_LIST.forEach((mod) => {
      const baseMod = basePermissions[mod.code] || {
        view: false,
        create: false,
        edit: false,
        delete: false,
        approve: false,
        export: false,
        lock: false
      };

      if (hasCustom && customPerms && customPerms[mod.code] !== undefined) {
        // Individual custom override takes strict precedence
        const modPerm = customPerms[mod.code];
        result[mod.code] = {
          view: !!modPerm?.view,
          create: !!modPerm?.create,
          edit: !!modPerm?.edit,
          delete: !!modPerm?.delete,
          approve: !!modPerm?.approve,
          export: !!modPerm?.export,
          lock: !!modPerm?.lock
        };
      } else if (hasCustom) {
        // Default Deny for modules omitted from an explicit custom permission matrix
        result[mod.code] = {
          view: false,
          create: false,
          edit: false,
          delete: false,
          approve: false,
          export: false,
          lock: false
        };
      } else {
        result[mod.code] = { ...baseMod };
      }

      // Trang chủ / Bảng điều khiển luôn mở cho tài khoản đã đăng nhập
      if (mod.code === 'home') {
        result[mod.code] = {
          view: true,
          create: false,
          edit: false,
          delete: false,
          approve: false,
          export: false,
          lock: false
        };
      }

      // ONLY System Administrator has blanket override for everything
      if (isSystemAdmin) {
        result[mod.code] = {
          view: true,
          create: true,
          edit: true,
          delete: true,
          approve: true,
          export: true,
          lock: true
        };
      }
    });

    return result;
  }, [user, roleGroup, isSystemAdmin, permissionsVersion]);

  /**
   * Check if user has specific permission on module
   */
  const hasPermission = (moduleCode: ModuleCode, action: PermissionAction): boolean => {
    if (!user) return false;
    if (isSystemAdmin) return true;
    if (moduleCode === 'home' && action === 'view') return true;

    const modPerm = effectivePermissions[moduleCode];
    if (!modPerm) return false;
    return !!modPerm[action];
  };

  /**
   * Helper shortcuts
   */
  const canAccessModule = (moduleCode: ModuleCode) => {
    if (!user) return false;
    if (moduleCode === 'home') return true;
    return hasPermission(moduleCode, 'view');
  };
  const canCreate = (moduleCode: ModuleCode) => hasPermission(moduleCode, 'create');
  const canEdit = (moduleCode: ModuleCode) => hasPermission(moduleCode, 'edit');
  const canDelete = (moduleCode: ModuleCode) => hasPermission(moduleCode, 'delete');
  const canApprove = (moduleCode: ModuleCode) => hasPermission(moduleCode, 'approve');
  const canExport = (moduleCode: ModuleCode) => hasPermission(moduleCode, 'export');
  const canLock = (moduleCode: ModuleCode) => hasPermission(moduleCode, 'lock');

  /**
   * Scope-level validation: checks whether user can evaluate or modify data of a target teacher
   */
  const isScopeAllowedForTeacher = (targetTeacherId: string, targetDepartmentId?: string): boolean => {
    if (!user) return false;
    if (isSystemAdmin || roleGroup === 'BGH') return true;

    if (roleGroup === 'TTCM') {
      if (!user.departmentId) return false;
      return user.departmentId === targetDepartmentId;
    }

    return user.id === targetTeacherId;
  };

  /**
   * Scope-level validation: checks whether user can manage a specific homeroom class
   */
  const isScopeAllowedForHomeroom = (className?: string): boolean => {
    if (!user) return false;
    if (isSystemAdmin || roleGroup === 'BGH' || roleGroup === 'DOAN') return true;

    const anyUser = user as any;
    if (roleGroup === 'GVCN' && anyUser.homeroomClass) {
      return anyUser.homeroomClass === className;
    }
    return false;
  };

  return {
    user,
    roleGroup,
    roleGroupConfig: DEFAULT_ROLE_GROUPS[roleGroup],
    permissionsReady,
    permissionSyncError,
    isAdmin: isSystemAdmin,
    isSystemAdmin,
    isBGH: roleGroup === 'BGH' || isSystemAdmin,
    isTTCM: roleGroup === 'TTCM',
    isTeacher: roleGroup === 'TEACHER',
    isGVCN: roleGroup === 'GVCN',
    isDoan: roleGroup === 'DOAN',
    isStaff: roleGroup === 'STAFF',
    effectivePermissions,
    hasPermission,
    canAccessModule,
    canCreate,
    canEdit,
    canDelete,
    canApprove,
    canExport,
    canLock,
    isScopeAllowedForTeacher,
    isScopeAllowedForHomeroom
  };
}
