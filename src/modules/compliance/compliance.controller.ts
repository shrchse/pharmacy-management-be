import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../utils/apiResponse';
import { getTenantId } from '../../utils/scope';

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const licenseSchema = z.object({
  branchId: z.string().uuid().optional(),
  code: z.string().min(1),
  type: z.string().min(1),
  holderName: z.string().optional(),
  number: z.string().min(1),
  issuedAt: z.coerce.date().optional(),
  expiredAt: z.coerce.date(),
  status: z.string().min(1).default('ACTIVE'),
  notes: z.string().optional(),
});

const practitionerLicenseSchema = z.object({
  branchId: z.string().uuid().optional(),
  practitionerName: z.string().min(1),
  profession: z.string().min(1).default('APOTEKER'),
  licenseType: z.string().min(1),
  number: z.string().min(1),
  issuedAt: z.coerce.date().optional(),
  expiredAt: z.coerce.date(),
  status: z.string().min(1).default('ACTIVE'),
  notes: z.string().optional(),
});

const updateLicenseSchema = licenseSchema.partial();
const updatePractitionerLicenseSchema = practitionerLicenseSchema.partial();

const alertWindows = [90, 60, 30, 7];

const daysUntil = (date: Date) => {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
};

const alertLevel = (days: number) => {
  if (days < 0) return 'EXPIRED';
  return alertWindows.find((window) => days <= window) ?? null;
};

export const listLicenses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const licenses = await prisma.license.findMany({
      where: { tenantId },
      orderBy: [{ expiredAt: 'asc' }, { type: 'asc' }],
    });

    return sendSuccess(res, licenses, 'Licenses retrieved', 200, { count: licenses.length });
  } catch (error) {
    return next(error);
  }
};

export const createLicense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = licenseSchema.parse(req.body);
    const license = await prisma.$transaction(async (tx) => {
      const created = await tx.license.create({ data: { tenantId, ...payload } });
      await auditLog({ tenantId, branchId: created.branchId, actorId: req.auth?.userId, action: 'CREATE', entity: 'License', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, license, 'License created', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateLicense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = updateLicenseSchema.parse(req.body);
    const license = await prisma.$transaction(async (tx) => {
      const before = await tx.license.findFirstOrThrow({ where: { id, tenantId } });
      const updated = await tx.license.update({ where: { id }, data: payload });
      await auditLog({ tenantId, branchId: updated.branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'License', entityId: id, before, after: updated, req }, tx);
      return updated;
    });

    return sendSuccess(res, license, 'License updated');
  } catch (error) {
    return next(error);
  }
};

export const listPractitionerLicenses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const licenses = await prisma.practitionerLicense.findMany({
      where: { tenantId },
      orderBy: [{ expiredAt: 'asc' }, { practitionerName: 'asc' }],
    });

    return sendSuccess(res, licenses, 'Practitioner licenses retrieved', 200, { count: licenses.length });
  } catch (error) {
    return next(error);
  }
};

export const createPractitionerLicense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = practitionerLicenseSchema.parse(req.body);
    const license = await prisma.$transaction(async (tx) => {
      const created = await tx.practitionerLicense.create({ data: { tenantId, ...payload } });
      await auditLog({ tenantId, branchId: created.branchId, actorId: req.auth?.userId, action: 'CREATE', entity: 'PractitionerLicense', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, license, 'Practitioner license created', 201);
  } catch (error) {
    return next(error);
  }
};

export const updatePractitionerLicense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = updatePractitionerLicenseSchema.parse(req.body);
    const license = await prisma.$transaction(async (tx) => {
      const before = await tx.practitionerLicense.findFirstOrThrow({ where: { id, tenantId } });
      const updated = await tx.practitionerLicense.update({ where: { id }, data: payload });
      await auditLog({ tenantId, branchId: updated.branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'PractitionerLicense', entityId: id, before, after: updated, req }, tx);
      return updated;
    });

    return sendSuccess(res, license, 'Practitioner license updated');
  } catch (error) {
    return next(error);
  }
};

export const licenseAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const until = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const [licenses, practitionerLicenses] = await Promise.all([
      prisma.license.findMany({
        where: { tenantId, status: 'ACTIVE', expiredAt: { lte: until } },
        orderBy: { expiredAt: 'asc' },
      }),
      prisma.practitionerLicense.findMany({
        where: { tenantId, status: 'ACTIVE', expiredAt: { lte: until } },
        orderBy: { expiredAt: 'asc' },
      }),
    ]);

    const alerts = [
      ...licenses.map((license) => {
        const days = daysUntil(license.expiredAt);
        return {
          source: 'License',
          id: license.id,
          branchId: license.branchId,
          type: license.type,
          number: license.number,
          holderName: license.holderName,
          expiredAt: license.expiredAt,
          daysUntilExpiry: days,
          level: alertLevel(days),
        };
      }),
      ...practitionerLicenses.map((license) => {
        const days = daysUntil(license.expiredAt);
        return {
          source: 'PractitionerLicense',
          id: license.id,
          branchId: license.branchId,
          type: license.licenseType,
          number: license.number,
          holderName: license.practitionerName,
          expiredAt: license.expiredAt,
          daysUntilExpiry: days,
          level: alertLevel(days),
        };
      }),
    ].filter((alert) => alert.level !== null);

    return sendSuccess(res, alerts, 'License alerts retrieved', 200, { count: alerts.length, windows: alertWindows });
  } catch (error) {
    return next(error);
  }
};
