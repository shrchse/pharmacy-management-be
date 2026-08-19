import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '../../generated/prisma/client';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../utils/apiResponse';
import { getOptionalBranchId, getTenantId } from '../../utils/scope';

const money = (value: number) => value.toFixed(2);

const memberSchema = z.object({
  memberNo: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  birthDate: z.coerce.date().optional(),
  gender: z.string().optional(),
  points: z.number().int().min(0).default(0),
});

const campaignSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.enum(['BROADCAST', 'PROMO', 'LOYALTY', 'REMINDER']).default('BROADCAST'),
  channel: z.enum(['WHATSAPP', 'SMS', 'EMAIL', 'IN_APP']).default('WHATSAPP'),
  status: z.enum(['DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED']).default('DRAFT'),
  segment: z.string().optional(),
  message: z.string().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});

type TierRule = {
  name: string;
  minSpent: number;
};

const defaultTiers: TierRule[] = [
  { name: 'PLATINUM', minSpent: 10000000 },
  { name: 'GOLD', minSpent: 5000000 },
  { name: 'SILVER', minSpent: 1000000 },
  { name: 'BASIC', minSpent: 0 },
];

const toJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

const parseTierRules = (value: unknown): TierRule[] => {
  if (!Array.isArray(value)) return defaultTiers;
  const rules = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      if (typeof record.name !== 'string' || typeof record.minSpent !== 'number') return null;
      return { name: record.name, minSpent: record.minSpent };
    })
    .filter((item): item is TierRule => item !== null)
    .sort((a, b) => b.minSpent - a.minSpent);

  return rules.length ? rules : defaultTiers;
};

const pickTier = (spent: number, tiers: TierRule[]) => {
  return tiers.find((tier) => spent >= tier.minSpent)?.name ?? 'BASIC';
};

const metricsObject = (value: Prisma.JsonValue) => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

export const listMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const q = z.string().optional().parse(req.query.q);
    const [customers, saleStats, tierPolicy] = await Promise.all([
      prisma.customer.findMany({
        where: {
          tenantId,
          OR: q
            ? [
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { memberNo: { contains: q, mode: 'insensitive' } },
              ]
            : undefined,
        },
        orderBy: { name: 'asc' },
        take: 200,
      }),
      prisma.sale.groupBy({
        by: ['customerId'],
        where: { tenantId, status: 'COMPLETED', customerId: { not: null } },
        _count: { id: true },
        _sum: { grandTotal: true },
      }),
      prisma.tenantPolicy.findUnique({
        where: { tenantId_code: { tenantId, code: 'crm.tiers' } },
      }),
    ]);

    const statsByCustomer = new Map(
      saleStats
        .filter((item) => item.customerId)
        .map((item) => [item.customerId as string, {
          transactionCount: item._count.id,
          totalSpent: Number(item._sum.grandTotal ?? 0),
        }])
    );
    const tiers = parseTierRules(tierPolicy?.value);

    const members = customers.map((customer) => {
      const stats = statsByCustomer.get(customer.id) ?? { transactionCount: 0, totalSpent: 0 };
      return {
        ...customer,
        crm: {
          transactionCount: stats.transactionCount,
          totalSpent: money(stats.totalSpent),
          tier: pickTier(stats.totalSpent, tiers),
        },
      };
    });

    return sendSuccess(res, members, 'CRM members retrieved', 200, { count: members.length });
  } catch (error) {
    return next(error);
  }
};

export const createMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = memberSchema.parse(req.body);

    const member = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          tenantId,
          memberNo: payload.memberNo,
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          address: payload.address,
          birthDate: payload.birthDate,
          gender: payload.gender,
          points: payload.points,
        },
      });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'CREATE', entity: 'Customer', entityId: created.id, after: created, metadata: { source: 'crm.member' }, req }, tx);
      return created;
    });

    return sendSuccess(res, member, 'CRM member created', 201);
  } catch (error) {
    return next(error);
  }
};

export const listCampaigns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getOptionalBranchId(req);
    const campaigns = await prisma.analyticsSnapshot.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        scope: 'CRM_CAMPAIGN',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return sendSuccess(res, campaigns.map((campaign) => ({
      id: campaign.id,
      branchId: campaign.branchId,
      period: campaign.period,
      ...metricsObject(campaign.metrics),
      createdAt: campaign.createdAt,
    })), 'CRM campaigns retrieved', 200, { count: campaigns.length });
  } catch (error) {
    return next(error);
  }
};

export const createCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const resolvedBranchId = getOptionalBranchId(req);
    const payload = campaignSchema.parse(req.body);
    const branchId = payload.branchId ?? resolvedBranchId;

    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.analyticsSnapshot.create({
        data: {
          tenantId,
          branchId,
          scope: 'CRM_CAMPAIGN',
          period: new Date(),
          metrics: toJsonValue({
            name: payload.name,
            type: payload.type,
            channel: payload.channel,
            status: payload.status,
            segment: payload.segment,
            message: payload.message,
            startsAt: payload.startsAt,
            endsAt: payload.endsAt,
            createdById: req.auth?.userId,
          }),
        },
      });

      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'CREATE', entity: 'CrmCampaign', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, {
      id: campaign.id,
      branchId: campaign.branchId,
      period: campaign.period,
      ...metricsObject(campaign.metrics),
      createdAt: campaign.createdAt,
    }, 'CRM campaign created', 201);
  } catch (error) {
    return next(error);
  }
};
