import { useMemo } from 'react';
import { useAuth } from '../store/AuthContext';
import { 
  ModuleCode, 
  PermissionAction, 
  RoleGroupCode, 
  DEFAULT_ROLE_GROUPS, 
  ModuleActionPermissions,
  SYSTEM_MODULES_LIST 
} from '../types/permission';
import { detectRoleGroupByPosition, getStoredUserCustomPermissions } from '../services/accountService';

export function usePermission() {
  const { user } = useAuth();

  // True system administrator ONLY (admin user account)
  const isSystemAdmin = useMemo(() => {
    if (!user) return false;
    const cleanUser = String(user.username || user.id || '').toLowerCase().trim();
    return cleanUser === 'admin' || user.role === 'admin' || (user as any).roleGroup === 'ADMIN';
  }, [user]);

  // Determine user's effective role group
  const roleGroup: RoleGroupCode = useMemo(() => {
    if (!user) return 'TEACHER';
    const cleanUser = String(user.username || user.id || '').toLowerCase().trim();
    if (cleanUser === 'admin' || user.role === 'admin' || (user as any).roleGroup === 'ADMIN') {
      return 'ADMIN';
    }
    // Check if user has explicit accountRole or roleGroup
    const anyUser = user as any;
    if (anyUser.roleGroup && DEFAULT_ROLE_GROUPS[anyUser.roleGroup as RoleGroupCode]) {
      return anyUser.roleGroup as RoleGroupCode;
    }
    if (anyUser.accountRole && DEFAULT_ROLE_GROUPS[anyUser.accountRole as RoleGroupCode]) {
      return anyUser.accountRole as RoleGroupCode;
    }
    if (user.role === 'BGH') return 'BGH';
    if (user.role === 'TTCM') return 'TTCM';

    // Fallback to position detection
    return detectRoleGroupByPosition(user.position, user.departmentId);
  }, [user]);

  // Compute effective permissions for all modules
  const effectivePermissions = useMemo(() => {
    const anyUser = user as any;
    let hasCustom = !!anyUser?.hasCustomPermissions;
    let customPerms = anyUser?.customPermissions as Partial<Record<ModuleCode, ModuleActionPermissions>> | undefined;

    // Fallback: check stored custom permissions map if user object in memory lacks it
    if (!hasCustom || !customPerms || Object.keys(customPerms).length === 0) {
      const storedMap = getStoredUserCustomPermissions();
      const uId = (user?.id || '').toLowerCase().trim();
      const uName = (user?.username || '').toLowerCase().trim();
      const uCode = (anyUser?.teacherCode || '').toLowerCase().trim();
      const matched = (uId && storedMap[uId]) || (uName && storedMap[uName]) || (uCode && storedMap[uCode]);
      if (matched && Object.keys(matched).length > 0) {
        hasCustom = true;
        customPerms = matched;
      }
    }

    // Default Deny / Strict Baseline: If user has NO custom permissions and is NOT BGH/ADMIN,
    // strictly fall back to TEACHER baseline permissions to prevent role group (TTCM, GVCN, etc.) permission leakage.
    let effectiveRoleGroup = roleGroup;
    if (!hasCustom && !isSystemAdmin && roleGroup !== 'BGH') {
      effectiveRoleGroup = 'TEACHER';
    }

    const baseConfig = DEFAULT_ROLE_GROUPS[effectiveRoleGroup] || DEFAULT_ROLE_GROUPS.TEACHER;
    const basePermissions = baseConfig.permissions;

    const result: Record<ModuleCode, ModuleActionPermissions> = {} as any;

    SYSTEM_MODULES_LIST.forEach(mod => {
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
        // Individual custom override takes precedence: strictly use custom matrix settings
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
        // If teacher has a custom permission assignment but this module is not in it, strictly deny
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

      // Trang chủ / Bảng điều khiển là không gian làm việc chính, luôn mở cho mọi tài khoản đã đăng nhập
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
  }, [user, roleGroup, isSystemAdmin]);

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
    
    // TTCM can only evaluate teachers in their department
    if (roleGroup === 'TTCM') {
      if (!user.departmentId) return false;
      return user.departmentId === targetDepartmentId;
    }

    // Teacher can only self-evaluate
    return user.id === targetTeacherId;
  };

  /**
   * Scope-level validation: checks whether user can manage a specific homeroom class
   */
  const isScopeAllowedForHomeroom = (className?: string): boolean => {
    if (!user) return false;
    if (isSystemAdmin || roleGroup === 'BGH' || roleGroup === 'DOAN') return true;
    
    // GVCN check
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
