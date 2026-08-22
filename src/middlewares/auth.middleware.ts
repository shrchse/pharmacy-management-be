import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma, runWithPrismaContext } from '../lib/prisma';
import { sendError } from '../utils/apiResponse';

const jwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  permissions: z.array(z.string()).optional(),
});

export type AuthContext = z.infer<typeof jwtPayloadSchema> & {
  userId: string;
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header) {
    return next();
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const payload = jwtPayloadSchema.parse(decoded);
    req.auth = {
      ...payload,
      userId: payload.sub,
    };
  } catch {
    return next();
  }

  return next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  optionalAuth(req, res, () => {
    if (!req.auth) {
      return sendError(res, 'Authentication required', 401);
    }

    return runWithPrismaContext({
      tenantId: req.auth.tenantId,
      branchId: req.auth.branchId,
    }, next);
  });
};

export const resolveTenantId = (req: Request) => {
  return req.auth?.tenantId ?? req.params.tenantId ?? req.query.tenantId ?? req.body?.tenantId;
};

export const resolveBranchId = (req: Request) => {
  return (
    req.headers['x-branch-id'] ??
    req.headers['x-outlet-id'] ??
    req.auth?.branchId ??
    req.params.branchId ??
    req.params.outletId ??
    req.query.branchId ??
    req.query.outletId ??
    req.body?.branchId ??
    req.body?.outletId
  );
};

export const requirePermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
      const granted = new Set(req.auth?.permissions ?? []);
      if (permissions.every((permission) => granted.has(permission))) {
        return next();
      }

      return sendError(res, 'Missing required permission', 403, { required: permissions }, 'PERMISSION_DENIED');
    });
  };
};

export const requireAnyPermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
      const granted = new Set(req.auth?.permissions ?? []);
      if (permissions.some((permission) => granted.has(permission))) {
        return next();
      }

      return sendError(res, 'Missing required permission', 403, { requiredAny: permissions }, 'PERMISSION_DENIED');
    });
  };
};

export const requireSuperadmin = (req: Request, res: Response, next: NextFunction) => {
  requireAuth(req, res, async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.auth?.userId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      const normalizedRole = user?.role.name.replace(/[_-]/g, '').toLowerCase();
      const isSuperadmin = normalizedRole === 'superadmin';
      const hasPermission = user?.role.permissions.some(({ permission }) => permission.code === 'internal.tenant.manage');
      if (!isSuperadmin || !hasPermission) {
        return sendError(res, 'Superadmin access required', 403, undefined, 'PERMISSION_DENIED');
      }
      return next();
    } catch (error) {
      return next(error);
    }
  });
};

export const requireFeature = (featureCode: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, async () => {
      try {
        const tenantId = resolveTenantId(req);
        if (typeof tenantId !== 'string') {
          return sendError(res, 'tenantId is required', 400, undefined, 'TENANT_REQUIRED');
        }

        const feature = await prisma.tenantFeature.findUnique({
          where: {
            tenantId_code: {
              tenantId,
              code: featureCode,
            },
          },
        });

        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { subscriptionStatus: true, trialEndsAt: true, subscriptionEndsAt: true },
        });
        if (!tenant) {
          return sendError(res, 'Tenant not found', 404, undefined, 'TENANT_NOT_FOUND');
        }
        const now = new Date();
        const trialExpired = tenant.subscriptionStatus === 'TRIAL' && (!tenant.trialEndsAt || tenant.trialEndsAt <= now);
        const subscriptionExpired = tenant.subscriptionEndsAt !== null && tenant.subscriptionEndsAt <= now;
        if (['EXPIRED', 'CANCELLED', 'SUSPENDED'].includes(tenant.subscriptionStatus) || trialExpired || subscriptionExpired) {
          return sendError(res, 'Tenant subscription is not active', 403, { featureCode }, 'SUBSCRIPTION_INACTIVE');
        }

        if (!feature?.enabled) {
          return sendError(res, 'Feature is not enabled for this tenant', 403, { featureCode }, 'FEATURE_LOCKED');
        }

        return next();
      } catch (error) {
        return next(error);
      }
    });
  };
};
