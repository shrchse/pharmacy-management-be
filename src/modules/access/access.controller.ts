import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { sendError, sendSuccess } from '../../utils/apiResponse';
import { getTenantId } from '../../utils/scope';

const roleSchema = z.object({
  name: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9 _-]+$/),
  description: z.string().trim().max(255).optional(),
  permissionCodes: z.array(z.string().trim().min(1)).max(100).default([]),
});

const updateRoleSchema = roleSchema.partial();
const roleInclude = { permissions: { include: { permission: true }, orderBy: { permission: { code: 'asc' as const } } } } as const;

const permissionCodes = async (codes: string[]) => {
  const uniqueCodes = [...new Set(codes)];
  if (uniqueCodes.includes('internal.tenant.manage')) {
    throw new Error('internal.tenant.manage is reserved for superadmin');
  }
  const permissions = await prisma.permission.findMany({ where: { code: { in: uniqueCodes } } });
  const found = new Set(permissions.map((permission) => permission.code));
  const unknown = uniqueCodes.filter((code) => !found.has(code));
  if (unknown.length > 0) throw new Error(`Unknown permission code(s): ${unknown.join(', ')}`);
  return permissions;
};

export const listPermissions = async (_req: Request, res: Response, next: NextFunction) => {
  try { return sendSuccess(res, await prisma.permission.findMany({ orderBy: [{ category: 'asc' }, { code: 'asc' }] }), 'Permissions retrieved'); } catch (error) { return next(error); }
};

export const listRoles = async (req: Request, res: Response, next: NextFunction) => {
  try { return sendSuccess(res, await prisma.role.findMany({ where: { tenantId: getTenantId(req) }, include: roleInclude, orderBy: { name: 'asc' } }), 'Roles retrieved'); } catch (error) { return next(error); }
};

export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = roleSchema.parse(req.body);
    const permissions = await permissionCodes(payload.permissionCodes);
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({ data: { tenantId, name: payload.name, description: payload.description, isSystem: false, permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) } }, include: roleInclude });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'CREATE', entity: 'Role', entityId: created.id, after: created, req }, tx);
      return created;
    });
    return sendSuccess(res, role, 'Role created', 201);
  } catch (error) { if (error instanceof Error && (error.message.startsWith('Unknown permission') || error.message.includes('reserved for superadmin'))) return sendError(res, error.message, 400, undefined, 'INVALID_PERMISSION'); return next(error); }
};

export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const roleId = z.string().uuid().parse(req.params.id);
    const payload = updateRoleSchema.parse(req.body);
    const before = await prisma.role.findFirstOrThrow({ where: { id: roleId, tenantId }, include: roleInclude });
    if (before.isSystem || before.name === 'OWNER') return sendError(res, 'System or OWNER role cannot be modified', 403, undefined, 'ROLE_PROTECTED');
    const permissions = payload.permissionCodes === undefined ? undefined : await permissionCodes(payload.permissionCodes);
    const role = await prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({ where: { id: roleId }, data: { name: payload.name, description: payload.description, permissions: permissions === undefined ? undefined : { deleteMany: {}, create: permissions.map((permission) => ({ permissionId: permission.id })) } }, include: roleInclude });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Role', entityId: updated.id, before, after: updated, req }, tx);
      return updated;
    });
    return sendSuccess(res, role, 'Role updated');
  } catch (error) { if (error instanceof Error && (error.message.startsWith('Unknown permission') || error.message.includes('reserved for superadmin'))) return sendError(res, error.message, 400, undefined, 'INVALID_PERMISSION'); return next(error); }
};

export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const roleId = z.string().uuid().parse(req.params.id);
    const role = await prisma.role.findFirstOrThrow({ where: { id: roleId, tenantId }, include: { users: { select: { id: true } } } });
    if (role.isSystem || role.name === 'OWNER') return sendError(res, 'System or OWNER role cannot be deleted', 403, undefined, 'ROLE_PROTECTED');
    if (role.users.length > 0) return sendError(res, 'Role is still assigned to users', 409, undefined, 'ROLE_IN_USE');
    await prisma.$transaction(async (tx) => { await tx.role.delete({ where: { id: roleId } }); await auditLog({ tenantId, actorId: req.auth?.userId, action: 'DELETE', entity: 'Role', entityId: roleId, before: role, req }, tx); });
    return sendSuccess(res, { id: roleId }, 'Role deleted');
  } catch (error) { return next(error); }
};
