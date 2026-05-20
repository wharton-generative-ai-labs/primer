import { Permission, ROLES, Role } from '@/config/auth';
import { env } from '@/config/env';

export const isDevAuthBypassEnabled = (): boolean => {
  return env.NODE_ENV !== 'production' && env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';
};

export const getDevAuthEmail = (): string => {
  return env.DEV_AUTH_BYPASS_EMAIL || env.NEXT_PUBLIC_DEV_AUTH_EMAIL || 'dev-admin@primer.local';
};

export const getDevAuthRoles = (): Role[] => {
  return [ROLES.ADMIN];
};

export const getDevAuthPrivileges = (): Permission[] => {
  return ROLES.ADMIN.permissions;
};

export const getEffectiveUserEmail = (email?: string | null): string | null => {
  if (email) {
    return email;
  }
  return isDevAuthBypassEnabled() ? getDevAuthEmail() : null;
};

export const isDevAuthUser = (email?: string | null): boolean => {
  return !!email && isDevAuthBypassEnabled() && email === getDevAuthEmail();
};
