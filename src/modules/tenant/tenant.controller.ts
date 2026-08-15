import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../utils/apiResponse';
import { getTenantId } from '../../utils/scope';

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  planId: z.string().uuid().optional(),
  isDemo: z.boolean().default(false),
});

export const activeTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      include: {
        plan: true,
        features: true,
        branches: { orderBy: { name: 'asc' } },
      },
    });

    return sendSuccess(res, {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subscriptionStatus: tenant.subscriptionStatus,
        subscriptionEndsAt: tenant.subscriptionEndsAt,
        trialEndsAt: tenant.trialEndsAt,
        plan: tenant.plan,
        entitlements: tenant.features.map((feature) => ({
          code: feature.code,
          enabled: feature.enabled,
          config: feature.config,
        })),
      },
      branches: tenant.branches,
    }, 'Active tenant retrieved');
  } catch (error) {
    return next(error);
  }
};

export const listInternalTenants = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        plan: true,
        branches: true,
        features: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, tenants, 'Tenants retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createInternalTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createTenantSchema.parse(req.body);
    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name: payload.name,
          slug: payload.slug,
          email: payload.email,
          phone: payload.phone,
          address: payload.address,
          taxId: payload.taxId,
          planId: payload.planId,
          isDemo: payload.isDemo,
        },
      });

      await auditLog({
        tenantId: created.id,
        actorId: req.auth?.userId,
        action: 'CREATE',
        entity: 'Tenant',
        entityId: created.id,
        after: created,
        req,
      }, tx);

      return created;
    });

    return sendSuccess(res, tenant, 'Tenant created', 201);
  } catch (error) {
    return next(error);
  }
};
