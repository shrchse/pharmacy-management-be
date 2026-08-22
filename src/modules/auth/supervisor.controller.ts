import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { HttpError, sendSuccess } from '../../utils/apiResponse';
import { getBranchId, getTenantId } from '../../utils/scope';
import { requiredPermissionsForSupervisorAction, SupervisorAction } from '../../lib/supervisor';

const schema = z.object({
  supervisorId: z.string().uuid(),
  action: z.enum(['cancel_paid_trx', 'discount_over_50', 'return_over_sell', 'sell_empty_stock', 'delete_product_with_history', 'edit_sell_price']),
  password: z.string().min(1).optional(),
  pin: z.string().min(1).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
  expiresInSeconds: z.number().int().positive().max(1800).default(300),
}).refine((value) => Boolean(value.password || value.pin), { message: 'password or pin is required', path: ['password'] });

export const createSupervisorAuthorization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestedById = req.auth?.userId;
    if (!requestedById) throw new HttpError('Authentication required', 401, 'UNAUTHENTICATED');
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const payload = schema.parse(req.body);
    if (!branchId) throw new HttpError('branchId is required for supervisor authorization', 400, 'BRANCH_REQUIRED');
    if (payload.supervisorId === requestedById) throw new HttpError('A different supervisor is required', 400, 'SUPERVISOR_MUST_DIFFER');

    const result = await prisma.$transaction(async (tx) => {
      const supervisor = await tx.user.findFirst({
        where: { id: payload.supervisorId, tenantId, branchId, status: 'ACTIVE' },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      if (!supervisor) throw new HttpError('Supervisor not found for this tenant and branch', 404, 'SUPERVISOR_NOT_FOUND');
      const granted = new Set(supervisor.role.permissions.map((entry) => entry.permission.code));
      if (!requiredPermissionsForSupervisorAction(payload.action as SupervisorAction).every((permission) => granted.has(permission))) {
        throw new HttpError('Supervisor does not have permission for this action', 403, 'SUPERVISOR_PERMISSION_DENIED');
      }

      const credential = payload.pin && supervisor.apjPinHash ? payload.pin : payload.password;
      const hash = payload.pin && supervisor.apjPinHash ? supervisor.apjPinHash : supervisor.passwordHash;
      if (!credential || !(await bcrypt.compare(credential, hash))) throw new HttpError('Invalid supervisor credential', 403, 'SUPERVISOR_CREDENTIAL_INVALID');

      const authorization = await tx.supervisorAuthorization.create({
        data: {
          tenantId,
          branchId,
          requestedById,
          supervisorId: supervisor.id,
          action: payload.action,
          reason: payload.reason,
          metadata: payload.metadata ? JSON.parse(JSON.stringify(payload.metadata)) : undefined,
          expiresAt: new Date(Date.now() + payload.expiresInSeconds * 1000),
        },
        include: { supervisor: { select: { id: true, name: true, email: true } } },
      });
      await auditLog({ tenantId, branchId, actorId: supervisor.id, action: 'APPROVE', entity: 'SupervisorAuthorization', entityId: authorization.id, after: authorization, metadata: { requestedById, action: payload.action }, req }, tx);
      return authorization;
    });
    return sendSuccess(res, result, 'Supervisor authorization created', 201);
  } catch (error) { return next(error); }
};
