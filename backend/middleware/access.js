const { supabase } = require('../db');
const { isAdmin } = require('./auth');

const ALL_PERMISSIONS = [
  'admin.access', 'catalog.manage', 'orders.view', 'orders.fulfill', 'coupons.manage',
  'team.manage', 'settings.manage', 'logs.view',
];

async function getAccess(user) {
  if (!user) return null;
  if (isAdmin(user.email)) return { owner: true, roleName: 'Proprietario', permissions: ALL_PERMISSIONS };
  const { data: member, error: memberError } = await supabase
    .from('staff_members')
    .select('role_id, is_active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member?.is_active) return null;
  const { data: role, error: roleError } = await supabase
    .from('staff_roles')
    .select('name, permissions')
    .eq('id', member.role_id)
    .maybeSingle();
  if (roleError) throw roleError;
  if (!role) return null;
  const permissions = Array.isArray(role.permissions) ? role.permissions : [];
  return { owner: false, roleName: role.name, permissions };
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const access = await getAccess(req.user);
      if (!access || !access.permissions.includes(permission)) return res.status(403).json({ error: 'permission_denied' });
      req.access = access;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireOwner(req, res, next) {
  if (!isAdmin(req.user?.email)) return res.status(403).json({ error: 'owner_required' });
  req.access = { owner: true, roleName: 'Proprietario', permissions: ALL_PERMISSIONS };
  next();
}

module.exports = { ALL_PERMISSIONS, getAccess, requirePermission, requireOwner };
