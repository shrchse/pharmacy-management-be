import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../utils/apiResponse';
import { getBranchId, getTenantId } from '../../utils/scope';

export const listAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const action = z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'EXPORT']).optional().parse(req.query.action);
    const entity = z.string().trim().min(1).optional().parse(req.query.entity);
    const take = Math.min(200, Math.max(1, Number(z.coerce.number().int().positive().default(100).parse(req.query.take))));
    const logs = await prisma.auditLog.findMany({
      where: { tenantId, branchId, action, entity: entity ? { equals: entity, mode: 'insensitive' } : undefined },
      include: { actor: { select: { id: true, name: true, email: true } }, branch: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return sendSuccess(res, logs, 'Audit logs retrieved', 200, { count: logs.length });
  } catch (error) { return next(error); }
};
