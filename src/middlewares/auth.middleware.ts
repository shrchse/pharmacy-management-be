import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
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

    return next();
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
