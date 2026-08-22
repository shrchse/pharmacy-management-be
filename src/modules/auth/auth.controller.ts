import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { auditLog } from '../../lib/audit';
import { sendError, sendSuccess } from '../../utils/apiResponse';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const bootstrapSchema = z.object({
  tenant: z.object({
    name: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
    email: z.string().email(),
    phone: z.string().optional(),
    address: z.string().optional(),
    taxId: z.string().optional(),
  }),
  branch: z.object({
    code: z.string().min(1).default('MAIN'),
    name: z.string().min(1).default('Cabang Utama'),
    phone: z.string().optional(),
    address: z.string().optional(),
    siaNumber: z.string().optional(),
    apjName: z.string().optional(),
    apjSipaNumber: z.string().optional(),
  }).default({ code: 'MAIN', name: 'Cabang Utama' }),
  owner: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().optional(),
    sipaNumber: z.string().optional(),
  }),
});

const devTokenSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  permissions: z.array(z.string()).default([]),
});

const signAccessToken = (payload: {
  userId: string;
  tenantId: string;
  branchId?: string | null;
  roleId?: string | null;
  permissions?: string[];
}) => {
  return jwt.sign(
    {
      sub: payload.userId,
      tenantId: payload.tenantId,
      branchId: payload.branchId ?? undefined,
      roleId: payload.roleId ?? undefined,
      permissions: payload.permissions ?? [],
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any }
  );
};

const signRefreshToken = (userId: string) => {
  return jwt.sign(
    {
      sub: userId,
      type: 'refresh',
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
  );
};

const defaultPermissions = [
  ['tenant.manage', 'Manage tenant', 'Tenant'],
  ['branch.manage', 'Manage branches', 'Tenant'],
  ['user.manage', 'Manage users', 'Access Control'],
  ['role.manage', 'Manage roles', 'Access Control'],
  ['product.manage', 'Manage products', 'Inventory'],
  ['prescription.manage', 'Manage prescriptions', 'Pharmacy'],
  ['stock.read', 'Read stock', 'Inventory'],
  ['stock.adjust', 'Adjust stock', 'Inventory'],
  ['pos.checkout', 'POS checkout', 'POS'],
  ['sale.return', 'Process sale returns', 'POS'],
  ['purchase.manage', 'Manage purchases', 'Purchasing'],
  ['finance.manage', 'Manage finance', 'Finance'],
  ['compliance.manage', 'Manage compliance and licenses', 'Compliance'],
  ['report.read', 'Read reports', 'Reporting'],
  ['audit.read', 'Read audit logs', 'Audit'],
  ['master-data.manage', 'Manage master data', 'Master Data'],
] as const;

const defaultFeatures = [
  ['inventory', true],
  ['purchasing', true],
  ['finance', true],
  ['multi_outlet', false],
  ['resep', true],
  ['retail', false],
  ['crm', true],
  ['hrd', false],
  ['sop', false],
] as const;

const defaultTenantRoleSeeds = [
  { name: 'ADMIN', description: 'Tenant administrator', permissions: ['branch.manage', 'user.manage', 'role.manage', 'product.manage', 'stock.read', 'stock.adjust', 'pos.checkout', 'sale.return', 'purchase.manage', 'finance.manage', 'compliance.manage', 'report.read', 'audit.read', 'master-data.manage'] },
  { name: 'CASHIER', description: 'Cashier and sales operator', permissions: ['stock.read', 'pos.checkout', 'sale.return'] },
  { name: 'APJ', description: 'Apoteker penanggung jawab', permissions: ['product.manage', 'prescription.manage', 'stock.read', 'stock.adjust', 'pos.checkout', 'sale.return', 'purchase.manage', 'compliance.manage', 'report.read'] },
] as const;

const defaultPlans = [
  { code: 'start', name: 'Start', description: 'Operasional apotek satu outlet', maxBranches: 1, maxUsers: 5, features: { inventory: true, purchasing: true, finance: true, resep: true, crm: false, multi_outlet: false } },
  { code: 'grow', name: 'Grow', description: 'Operasional dan kontrol bisnis yang lebih lengkap', maxBranches: 3, maxUsers: 15, features: { inventory: true, purchasing: true, finance: true, resep: true, crm: true, multi_outlet: true } },
  { code: 'scale', name: 'Scale', description: 'Pengelolaan multi-outlet dan modul lanjutan', maxBranches: null, maxUsers: null, features: { inventory: true, purchasing: true, finance: true, resep: true, crm: true, multi_outlet: true, retail: true, hrd: true, sop: true } },
] as const;

const defaultCategories = [
  ['Obat Bebas', 'OBAT_BEBAS'],
  ['Obat Bebas Terbatas', 'OBAT_BEBAS_TERBATAS'],
  ['Obat Keras', 'OBAT_KERAS'],
  ['Psikotropika', 'PSIKOTROPIKA'],
  ['Narkotika', 'NARKOTIKA'],
  ['Alat Kesehatan', 'ALKES'],
  ['BMHP', 'BMHP'],
  ['Umum', 'UMUM'],
] as const;

const defaultUnits = [
  ['PCS', 'Pcs'],
  ['TABLET', 'Tablet'],
  ['STRIP', 'Strip'],
  ['BOX', 'Box'],
  ['BOTOL', 'Botol'],
] as const;

export const bootstrap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = bootstrapSchema.parse(req.body);
    const existingUsers = await prisma.user.count();

    if (existingUsers > 0) {
      return sendError(res, 'Bootstrap is only available before the first user exists', 409);
    }

    const passwordHash = await bcrypt.hash(payload.owner.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const plans = await Promise.all(defaultPlans.map((plan) => tx.plan.upsert({
        where: { code: plan.code },
        update: plan,
        create: plan,
      })));
      const startPlan = plans.find((plan) => plan.code === 'start');
      const tenant = await tx.tenant.create({
        data: {
          ...payload.tenant,
          planId: startPlan?.id,
          subscriptionStatus: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          ...payload.branch,
        },
      });

      const permissions = await Promise.all(
        defaultPermissions.map(([code, name, category]) =>
          tx.permission.upsert({
            where: { code },
            update: { name, category },
            create: { code, name, category },
          })
        )
      );

      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'OWNER',
          description: 'Tenant owner with full access',
          isSystem: false,
        },
      });

      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: ownerRole.id,
          permissionId: permission.id,
        })),
      });

      const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission.id]));
      for (const roleSeed of defaultTenantRoleSeeds) {
        const role = await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: roleSeed.name,
            description: roleSeed.description,
            isSystem: false,
          },
        });
        await tx.rolePermission.createMany({
          data: roleSeed.permissions.map((code) => ({ roleId: role.id, permissionId: permissionByCode.get(code)! })),
        });
      }

      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          roleId: ownerRole.id,
          name: payload.owner.name,
          email: payload.owner.email,
          phone: payload.owner.phone,
          sipaNumber: payload.owner.sipaNumber,
          passwordHash,
        },
      });

      await tx.category.createMany({
        data: defaultCategories.map(([name, type]) => ({
          tenantId: tenant.id,
          name,
          type,
        })),
      });

      await tx.unit.createMany({
        data: defaultUnits.map(([code, name]) => ({
          tenantId: tenant.id,
          code,
          name,
        })),
      });

      const planFeatureMap = new Map(Object.entries(startPlan?.features && typeof startPlan.features === 'object' && !Array.isArray(startPlan.features) ? startPlan.features : {}));
      await tx.tenantFeature.createMany({
        data: defaultFeatures.map(([code, enabled]) => ({
          tenantId: tenant.id,
          code,
          enabled: typeof planFeatureMap.get(code) === 'boolean' ? planFeatureMap.get(code) as boolean : enabled,
        })),
      });

      return {
        tenant,
        branch,
        owner: {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          tenantId: owner.tenantId,
          branchId: owner.branchId,
          roleId: owner.roleId,
        },
        permissions: permissions.map((permission) => permission.code),
      };
    });

    const accessToken = signAccessToken({
      userId: result.owner.id,
      tenantId: result.tenant.id,
      branchId: result.branch.id,
      roleId: result.owner.roleId,
      permissions: result.permissions,
    });
    const refreshToken = signRefreshToken(result.owner.id);

    return sendSuccess(res, { ...result, accessToken, refreshToken }, 'Bootstrap completed', 201);
  } catch (error) {
    return next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: {
        email: payload.email,
        status: 'ACTIVE',
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        tenant: true,
        branch: true,
      },
    });

    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    const isValidPassword = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isValidPassword) {
      return sendError(res, 'Invalid email or password', 401);
    }

    const permissions = user.role.permissions.map((rolePermission) => rolePermission.permission.code);
    const accessToken = signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      roleId: user.roleId,
      permissions,
    });
    const refreshToken = signRefreshToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await auditLog({ tenantId: user.tenantId, branchId: user.branchId, actorId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, metadata: { email: user.email }, req });

    return sendSuccess(res, {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role.name,
        permissions,
      },
      tenant: user.tenant,
      branch: user.branch,
    }, 'Login successful');
  } catch (error) {
    return next(error);
  }
};

export const logout = async (req: Request, res: Response) => {
  if (req.auth?.userId) {
    await auditLog({ tenantId: req.auth.tenantId, branchId: req.auth.branchId, actorId: req.auth.userId, action: 'LOGOUT', entity: 'User', entityId: req.auth.userId, req });
  }
  return sendSuccess(res, { revoked: false }, 'Logout successful. Discard the current access token on the client.');
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userId: string;

    // Check if refresh token is provided in request body
    const { refreshToken } = req.body;

    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as any;
        if (!decoded || decoded.type !== 'refresh' || !decoded.sub) {
          return sendError(res, 'Invalid refresh token payload', 401);
        }
        userId = decoded.sub;
      } catch (err) {
        return sendError(res, 'Refresh token expired or invalid', 401);
      }
    } else {
      // Fallback to active access token context if no refresh token is provided
      if (!req.auth) {
        return sendError(res, 'Authentication or refresh token required', 401);
      }
      userId = req.auth.userId;
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user) {
      return sendError(res, 'User is no longer active', 401);
    }

    const permissions = user.role.permissions.map((rolePermission) => rolePermission.permission.code);
    const accessToken = signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      roleId: user.roleId,
      permissions,
    });
    const newRefreshToken = signRefreshToken(user.id);

    return sendSuccess(res, {
      accessToken,
      refreshToken: newRefreshToken,
    }, 'Token refreshed');
  } catch (error) {
    return next(error);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return sendError(res, 'Authentication required', 401);
    }

    const user = await prisma.user.findFirst({
      where: {
        id: req.auth.userId,
        tenantId: req.auth.tenantId,
        status: 'ACTIVE',
      },
      include: {
        tenant: {
          include: {
            plan: true,
            features: true,
          },
        },
        branch: true,
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user) {
      return sendError(res, 'Authenticated user not found', 404);
    }

    const branches = await prisma.branch.findMany({
      where: { tenantId: user.tenantId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
    const permissions = user.role.permissions.map((rolePermission) => rolePermission.permission.code);

    return sendSuccess(res, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role.name,
        permissions,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        subscriptionStatus: user.tenant.subscriptionStatus,
        subscriptionEndsAt: user.tenant.subscriptionEndsAt,
        trialEndsAt: user.tenant.trialEndsAt,
        plan: user.tenant.plan,
        entitlements: user.tenant.features.map((feature) => ({
          code: feature.code,
          enabled: feature.enabled,
          config: feature.config,
        })),
      },
      activeBranch: user.branch,
      branches,
    }, 'Authenticated session retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createDevToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (env.NODE_ENV === 'production') {
      return sendError(res, 'Dev token endpoint is disabled in production', 403);
    }

    const payload = devTokenSchema.parse(req.body);
    const accessToken = signAccessToken({
      userId: payload.userId,
      tenantId: payload.tenantId,
      branchId: payload.branchId,
      roleId: payload.roleId,
      permissions: payload.permissions,
    });

    return sendSuccess(res, { accessToken }, 'Development token created');
  } catch (error) {
    return next(error);
  }
};
