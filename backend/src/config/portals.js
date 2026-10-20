// Which database roles may use which portal
export const PORTAL_ROLES = {
  citizen: ['citizen', 'volunteer'],
  admin: ['staff', 'admin', 'super_admin'],
};

export const canUsePortal = (role, portal) =>
  PORTAL_ROLES[portal]?.includes(role) ?? false;