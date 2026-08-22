/**
 * Mirrors backend/apps/common/roles.py. These two must stay in step: the value
 * decides which navigator loads and which API namespace the client may call.
 *
 * Adding a third role means adding it here, adding a roles/<role>/ tree, and
 * adding a branch in RootNavigator.
 */
export const ROLES = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Admins can use the floor screens too, matching STAFF_ROLES on the backend. */
export function canUseStaffScreens(role: Role): boolean {
  return role === ROLES.STAFF || role === ROLES.ADMIN;
}

export function isAdmin(role: Role): boolean {
  return role === ROLES.ADMIN;
}
