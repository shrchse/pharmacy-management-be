import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '../../generated/prisma/client';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { HttpError, sendSuccess } from '../../utils/apiResponse';
import { getTenantId } from '../../utils/scope';

const planSchema = z.object({
  code: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().optional(),
  priceMonthly: z.coerce.number().nonnegative().optional(),
  priceYearly: z.coerce.number().nonnegative().optional(),
  maxBranches: z.number().int().positive().nullable().optional(),
  maxUsers: z.number().int().positive().nullable().optional(),
  features: z.record(z.boolean()).default({}),
  isActive: z.boolean().optional(),
});

const planUpdateSchema = planSchema.partial();

const tenantProfileSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  planId: z.string().uuid().optional(),
  isDemo: z.boolean().default(false),
});

const subscriptionCreateSchema = z.object({
  type: z.enum(['TRIAL', 'PAID']).optional(),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
  trialDays: z.number().int().positive().max(90).default(14),
  startsAt: z.coerce.date().optional(),
});

const tenantBranchSchema = z.object({
  code: z.string().min(1).default('MAIN'),
  name: z.string().min(1).default('Cabang Utama'),
  businessCategory: z.enum(['APOTEK', 'TOKO_OBAT', 'KLINIK', 'PBF', 'DISTRIBUTOR']).default('APOTEK'),
  phone: z.string().optional(),
  address: z.string().optional(),
  siaNumber: z.string().optional(),
  apjName: z.string().optional(),
  apjSipaNumber: z.string().optional(),
});

const tenantOwnerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  sipaNumber: z.string().optional(),
});

const createTenantSchema = tenantProfileSchema.extend({
  subscription: subscriptionCreateSchema.optional(),
  branch: tenantBranchSchema.optional(),
  owner: tenantOwnerSchema.optional(),
});

const updateTenantSchema = tenantProfileSchema.partial().omit({ planId: true }).extend({
  planId: z.string().uuid().nullable().optional(),
});

const entitlementSchema = z.object({
  code: z.string().min(1),
  enabled: z.boolean(),
  config: z.unknown().optional(),
});

const subscriptionSchema = z.object({
  status: z.enum(['TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
  trialDays: z.coerce.number().int().positive().max(90).optional(),
  startsAt: z.coerce.date().optional(),
  trialEndsAt: z.coerce.date().nullable().optional(),
  subscriptionEndsAt: z.coerce.date().nullable().optional(),
  planId: z.string().uuid().nullable().optional(),
});

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const addBillingCycle = (date: Date, cycle: 'MONTHLY' | 'YEARLY') =>
  addDays(date, cycle === 'YEARLY' ? 365 : 30);

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
  reason: z.string().optional(),
});

const ownerPermissionSeeds = [
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

const defaultTenantRoleSeeds = [
  { name: 'ADMIN', description: 'Tenant administrator', permissions: ['branch.manage', 'user.manage', 'role.manage', 'product.manage', 'stock.read', 'stock.adjust', 'pos.checkout', 'sale.return', 'purchase.manage', 'finance.manage', 'compliance.manage', 'report.read', 'audit.read', 'master-data.manage'] },
  { name: 'CASHIER', description: 'Cashier and sales operator', permissions: ['stock.read', 'pos.checkout', 'sale.return'] },
  { name: 'APJ', description: 'Apoteker penanggung jawab', permissions: ['product.manage', 'prescription.manage', 'stock.read', 'stock.adjust', 'pos.checkout', 'sale.return', 'purchase.manage', 'compliance.manage', 'report.read'] },
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

const planFeatureMap = (features: Prisma.JsonValue): Record<string, boolean> => {
  if (Array.isArray(features)) {
    return Object.fromEntries(
      features
        .filter((code): code is string => typeof code === 'string' && code.length > 0)
        .map((code) => [code, true])
    );
  }
  if (!features || typeof features !== 'object' || Array.isArray(features)) return {};
  return Object.fromEntries(Object.entries(features).filter(([, value]) => typeof value === 'boolean')) as Record<string, boolean>;
};

const syncTenantFeatures = async (tx: Prisma.TransactionClient, tenantId: string, features: Prisma.JsonValue) => {
  await Promise.all(Object.entries(planFeatureMap(features)).map(([code, enabled]) => tx.tenantFeature.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { enabled },
    create: { tenantId, code, enabled },
  })));
};

export const listPlans = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    return sendSuccess(res, plans, 'Plans retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = planSchema.parse(req.body);
    const plan = await prisma.plan.create({
      data: {
        ...payload,
        features: JSON.parse(JSON.stringify(payload.features)) as Prisma.InputJsonValue,
      },
    });
    return sendSuccess(res, plan, 'Plan created', 201);
  } catch (error) {
    return next(error);
  }
};

export const updatePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const payload = planUpdateSchema.parse(req.body);
    const plan = await prisma.$transaction(async (tx) => {
      const before = await tx.plan.findUniqueOrThrow({ where: { id } });
      const updated = await tx.plan.update({
        where: { id },
        data: {
          ...payload,
          ...(payload.features === undefined
            ? {}
            : { features: JSON.parse(JSON.stringify(payload.features)) as Prisma.InputJsonValue }),
        },
      });
      await auditLog({
        tenantId: req.auth!.tenantId,
        actorId: req.auth!.userId,
        action: 'UPDATE',
        entity: 'Plan',
        entityId: id,
        before,
        after: updated,
        req,
      }, tx);
      return updated;
    });
    return sendSuccess(res, plan, 'Plan updated');
  } catch (error) {
    return next(error);
  }
};

export const deletePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id } });
    const tenantCount = await prisma.tenant.count({ where: { planId: id } });
    if (tenantCount > 0) {
      throw new HttpError('Plan is still assigned to tenants', 409, 'PLAN_IN_USE', { tenantCount });
    }
    await prisma.$transaction(async (tx) => {
      await tx.plan.delete({ where: { id } });
      await auditLog({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, action: 'DELETE', entity: 'Plan', entityId: id, before: plan, req }, tx);
    });
    return sendSuccess(res, { id, deleted: true }, 'Plan deleted');
  } catch (error) {
    return next(error);
  }
};

const tenantChildDeleteOrder = [
  'SyncConflict', 'SyncQueue', 'OfflineDevice', 'Attendance', 'ShiftSchedule', 'EmployeeProfile',
  'PurchasePlanItem', 'PurchasePlan', 'JournalLine', 'JournalEntry', 'Expense', 'CashMutation',
  'CashAccount', 'ReceivablePayment', 'Receivable', 'DebtPayment', 'Debt',
  'ConsignmentSettlement', 'ConsignmentItem', 'ConsignmentAgreement',
  'PurchaseReturnItem', 'PurchaseReturn', 'PurchaseItem', 'PurchaseApproval', 'Purchase',
  'SupplierProductPrice', 'SaleReturnItem', 'SaleReturn', 'SalePayment', 'SaleItem',
  'PrescriptionCopy', 'PrescriptionLabel', 'PrescriptionItem', 'Prescription', 'MedicalRecord',
  'Sale', 'CashierSession', 'ExpiredStockAction', 'StockOpnameItem', 'StockOpname',
  'StockTransfer', 'StockLedger', 'StockAlert', 'ProductBatch', 'StockLocation',
  'TenantProduct', 'Product', 'Supplier', 'Doctor', 'Customer', 'RejectedSale',
  'License', 'PractitionerLicense', 'AnalyticsSnapshot', 'IdempotencyKey',
  'AuditLog', 'SupervisorAuthorization', 'TenantFeature', 'TenantPolicy',
];

export const deleteInternalTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = z.string().uuid().parse(req.params.id);
    if (req.query.confirm !== 'DELETE') {
      throw new HttpError('Tenant deletion requires query confirmation', 400, 'DELETE_CONFIRMATION_REQUIRED', { confirm: 'DELETE' });
    }
    const deleted = await prisma.$transaction(async (tx) => {
      await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      // Keep the deletion list defensive: some legacy/optional tables do not
      // have a tenantId column even though their rows are related indirectly.
      const tenantTables = await tx.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'tenantId'
          AND table_name IN (${Prisma.join(tenantChildDeleteOrder)})
      `;
      const deleteOrder = new Map(tenantChildDeleteOrder.map((table, index) => [table, index]));
      tenantTables.sort((left, right) => (deleteOrder.get(left.table_name) ?? 0) - (deleteOrder.get(right.table_name) ?? 0));
      for (const { table_name: table } of tenantTables) {
        await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "tenantId" = $1`, tenantId);
      }
      await tx.$executeRawUnsafe('DELETE FROM "RolePermission" WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "tenantId" = $1)', tenantId);
      await tx.$executeRawUnsafe('DELETE FROM "User" WHERE "tenantId" = $1', tenantId);
      await tx.$executeRawUnsafe('DELETE FROM "Role" WHERE "tenantId" = $1', tenantId);
      await tx.$executeRawUnsafe('DELETE FROM "Category" WHERE "tenantId" = $1', tenantId);
      await tx.$executeRawUnsafe('DELETE FROM "Unit" WHERE "tenantId" = $1', tenantId);
      await tx.$executeRawUnsafe('DELETE FROM "Branch" WHERE "tenantId" = $1', tenantId);
      await tx.tenant.delete({ where: { id: tenantId } });
      return { id: tenantId, deleted: true };
    });
    return sendSuccess(res, deleted, 'Tenant and child data deleted');
  } catch (error) {
    return next(error);
  }
};

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
    const passwordHash = payload.owner ? await bcrypt.hash(payload.owner.password, 12) : undefined;
    const subscriptionType = payload.subscription?.type ?? (payload.planId && !payload.isDemo ? 'PAID' : 'TRIAL');
    if (subscriptionType === 'PAID' && !payload.planId) {
      throw new HttpError('planId is required for a paid subscription', 400, 'PLAN_REQUIRED');
    }
    const subscriptionStartedAt = payload.subscription?.startsAt ?? new Date();
    const billingCycle = payload.subscription?.billingCycle ?? 'MONTHLY';
    const subscriptionStatus = subscriptionType === 'PAID' ? 'ACTIVE' : 'TRIAL';
    const trialEndsAt = subscriptionType === 'TRIAL'
      ? addDays(subscriptionStartedAt, payload.subscription?.trialDays ?? 14)
      : null;
    const subscriptionEndsAt = subscriptionType === 'PAID'
      ? addBillingCycle(subscriptionStartedAt, billingCycle)
      : null;
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
          subscriptionStatus,
          subscriptionStartedAt,
          subscriptionBillingCycle: billingCycle,
          trialEndsAt,
          subscriptionEndsAt,
        },
      });

      // The request is authenticated in the system tenant, but all tenant
      // scoped records created below belong to the new tenant. Switch the
      // transaction-local RLS context before creating its branch, owner, and
      // default master data.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${created.id}, true)`;
      await tx.$executeRaw`SELECT set_config('app.branch_id', '', true)`;

      let branch: Awaited<ReturnType<typeof tx.branch.create>> | null = null;
      let owner: {
        id: string;
        tenantId: string;
        branchId: string | null;
        roleId: string;
        name: string;
        email: string;
        phone: string | null;
        sipaNumber: string | null;
        status: string;
      } | null = null;

      if (payload.planId) {
        const plan = await tx.plan.findUniqueOrThrow({ where: { id: payload.planId } });
        await syncTenantFeatures(tx, created.id, plan.features);
      }

      if (payload.branch || payload.owner) {
        const branchPayload = payload.branch ?? {
          code: 'MAIN',
          name: 'Cabang Utama',
          businessCategory: 'APOTEK' as const,
        };
        branch = await tx.branch.create({
          data: {
            tenantId: created.id,
            ...branchPayload,
          },
        });
      }

      if (payload.owner && passwordHash) {
        const permissions = await Promise.all(ownerPermissionSeeds.map(([code, name, category]) => tx.permission.upsert({
          where: { code },
          update: { name, category },
          create: { code, name, category },
        })));
        const ownerRole = await tx.role.create({
          data: {
            tenantId: created.id,
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
              tenantId: created.id,
              name: roleSeed.name,
              description: roleSeed.description,
              isSystem: false,
            },
          });
          await tx.rolePermission.createMany({
            data: roleSeed.permissions.map((code) => ({ roleId: role.id, permissionId: permissionByCode.get(code)! })),
          });
        }

        owner = await tx.user.create({
          data: {
            tenantId: created.id,
            branchId: branch?.id,
            roleId: ownerRole.id,
            name: payload.owner.name,
            email: payload.owner.email,
            phone: payload.owner.phone,
            sipaNumber: payload.owner.sipaNumber,
            passwordHash,
          },
          select: {
            id: true,
            tenantId: true,
            branchId: true,
            roleId: true,
            name: true,
            email: true,
            phone: true,
            sipaNumber: true,
            status: true,
          },
        });

        await tx.category.createMany({
          data: defaultCategories.map(([name, type]) => ({
            tenantId: created.id,
            name,
            type,
          })),
        });

        await tx.unit.createMany({
          data: defaultUnits.map(([code, name]) => ({
            tenantId: created.id,
            code,
            name,
          })),
        });
      }

      await auditLog({
        tenantId: created.id,
        actorId: req.auth?.userId,
        action: 'CREATE',
        entity: 'Tenant',
        entityId: created.id,
        after: { ...created, branch, owner },
        req,
      }, tx);

      return { ...created, branch, owner };
    });

    return sendSuccess(res, tenant, payload.owner ? 'Tenant onboarded' : 'Tenant created', 201);
  } catch (error) {
    return next(error);
  }
};

export const getInternalTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: z.string().uuid().parse(req.params.id) },
      include: { plan: true, branches: true, features: true, users: { select: { id: true, name: true, email: true, status: true } } },
    });
    return sendSuccess(res, tenant, 'Tenant retrieved');
  } catch (error) {
    return next(error);
  }
};

export const updateInternalTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const payload = updateTenantSchema.parse(req.body);
    if (payload.planId) await prisma.plan.findUniqueOrThrow({ where: { id: payload.planId } });
    const tenant = await prisma.$transaction(async (tx) => {
      const before = await tx.tenant.findUniqueOrThrow({ where: { id } });
      const updated = await tx.tenant.update({ where: { id }, data: payload });
      if (payload.planId) {
        const plan = await tx.plan.findUniqueOrThrow({ where: { id: payload.planId } });
        await syncTenantFeatures(tx, id, plan.features);
      }
      await auditLog({ tenantId: id, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Tenant', entityId: id, before, after: updated, req }, tx);
      return updated;
    });
    return sendSuccess(res, tenant, 'Tenant updated');
  } catch (error) {
    return next(error);
  }
};

export const updateTenantEntitlement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = z.string().uuid().parse(req.params.id);
    const payload = entitlementSchema.parse(req.body);
    const feature = await prisma.$transaction(async (tx) => {
      const updated = await tx.tenantFeature.upsert({
        where: { tenantId_code: { tenantId, code: payload.code } },
        update: { enabled: payload.enabled, config: payload.config === undefined ? undefined : JSON.parse(JSON.stringify(payload.config)) as Prisma.InputJsonValue },
        create: { tenantId, code: payload.code, enabled: payload.enabled, config: payload.config === undefined ? undefined : JSON.parse(JSON.stringify(payload.config)) as Prisma.InputJsonValue },
      });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'TenantFeature', entityId: updated.id, after: updated, req }, tx);
      return updated;
    });
    return sendSuccess(res, feature, 'Tenant entitlement updated');
  } catch (error) {
    return next(error);
  }
};

export const updateTenantSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = z.string().uuid().parse(req.params.id);
    const payload = subscriptionSchema.parse(req.body);
    if (payload.planId) await prisma.plan.findUniqueOrThrow({ where: { id: payload.planId } });
    const tenant = await prisma.$transaction(async (tx) => {
      const before = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      const startsAt = payload.startsAt ?? new Date();
      const billingCycle = payload.billingCycle ?? before.subscriptionBillingCycle ?? 'MONTHLY';
      const trialEndsAt = payload.status === 'TRIAL'
        ? payload.trialEndsAt ?? addDays(startsAt, payload.trialDays ?? 14)
        : null;
      const subscriptionEndsAt = payload.status === 'ACTIVE'
        ? payload.subscriptionEndsAt ?? addBillingCycle(startsAt, billingCycle)
        : payload.subscriptionEndsAt ?? (payload.status === 'EXPIRED' ? before.subscriptionEndsAt : null);
      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionStatus: payload.status,
          subscriptionStartedAt: startsAt,
          subscriptionBillingCycle: billingCycle,
          trialEndsAt,
          subscriptionEndsAt,
          planId: payload.planId,
        },
        include: { plan: true, features: true },
      });
      if (payload.planId) {
        const plan = await tx.plan.findUniqueOrThrow({ where: { id: payload.planId } });
        await syncTenantFeatures(tx, tenantId, plan.features);
      }
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Subscription', entityId: tenantId, before, after: updated, req }, tx);
      return updated;
    });
    return sendSuccess(res, tenant, 'Tenant subscription updated');
  } catch (error) {
    return next(error);
  }
};

export const resetTenantUserPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = z.string().uuid().parse(req.params.tenantId);
    const userId = z.string().uuid().parse(req.params.userId);
    const payload = resetPasswordSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(payload.newPassword, 12);

    const user = await prisma.$transaction(async (tx) => {
      const before = await tx.user.findFirstOrThrow({
        where: { id: userId, tenantId },
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          roleId: true,
          name: true,
          email: true,
          phone: true,
          sipaNumber: true,
          status: true,
        },
      });

      const updated = await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          roleId: true,
          name: true,
          email: true,
          phone: true,
          sipaNumber: true,
          status: true,
        },
      });

      await auditLog({
        tenantId,
        branchId: updated.branchId,
        actorId: req.auth?.userId,
        action: 'UPDATE',
        entity: 'UserPassword',
        entityId: userId,
        before,
        after: updated,
        metadata: { reason: payload.reason },
        req,
      }, tx);

      return updated;
    });

    return sendSuccess(res, user, 'Tenant user password reset');
  } catch (error) {
    return next(error);
  }
};

export const resetDemoTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = z.string().uuid().parse(req.params.id);
    const tenant = await prisma.$transaction(async (tx) => {
      const before = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      const startedAt = new Date();
      const updated = await tx.tenant.update({ where: { id: tenantId }, data: { subscriptionStatus: 'TRIAL', subscriptionStartedAt: startedAt, subscriptionBillingCycle: 'MONTHLY', trialEndsAt: addDays(startedAt, 14), subscriptionEndsAt: null, isDemo: true } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'TenantDemo', entityId: tenantId, before, after: updated, req }, tx);
      return updated;
    });
    return sendSuccess(res, tenant, 'Demo tenant reset');
  } catch (error) {
    return next(error);
  }
};

export const switchActiveTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = z.string().uuid().parse(req.body.branchId);
    const branch = await prisma.branch.findFirstOrThrow({ where: { id: branchId, tenantId, status: 'ACTIVE' } });
    return sendSuccess(res, { tenantId, branch }, 'Active branch selected');
  } catch (error) {
    return next(error);
  }
};
