import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { HttpError, sendSuccess } from '../../utils/apiResponse';
import { getBranchId, getTenantId } from '../../utils/scope';

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const prescriptionItemSchema = z.object({
  productId: z.string().uuid().optional(),
  medicineName: z.string().min(1),
  qtyRequired: z.coerce.number().positive(),
  dosageInstruction: z.string().optional(),
  labelText: z.string().optional(),
  isCompounded: z.boolean().default(false),
});

const prescriptionSchema = z.object({
  prescriptionNumber: z.string().min(1).optional(),
  source: z.enum(['MANUAL', 'DOCTOR_RME', 'COPY_FROM_OTHER_PHARMACY', 'TELEPHARMACY']).default('MANUAL'),
  repeatType: z.enum(['NONE', 'ITEM_ITER', 'FULL_ITER']).default('NONE'),
  repeatLimit: z.number().int().positive().optional(),
  doctorId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  attachmentUrl: z.string().url().optional(),
  notes: z.string().optional(),
  items: z.array(prescriptionItemSchema).min(1),
});

const updatePrescriptionSchema = prescriptionSchema
  .omit({ prescriptionNumber: true, items: true })
  .partial()
  .extend({
    status: z.enum(['RECEIVED', 'PARTIALLY_REDEEMED', 'REDEEMED', 'CANCELLED']).optional(),
    items: z.array(prescriptionItemSchema).min(1).optional(),
  });

const dispenseSchema = z.object({
  saleId: z.string().uuid(),
  notes: z.string().optional(),
});

const prescriptionInclude = {
  customer: true,
  doctor: true,
  verifiedBy: { select: { id: true, name: true, email: true } },
  sale: {
    include: {
      saleItems: { include: { product: true, productUnit: { include: { unit: true } }, batch: true } },
      payments: true,
    },
  },
  items: { include: { product: true } },
  labels: true,
  copies: true,
} as const;

const prescriptionNumber = () => {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RX-${stamp}-${suffix}`;
};

const createLabels = (tenantId: string, patientName: string | undefined, items: z.infer<typeof prescriptionItemSchema>[]) => {
  return items.map((item) => ({
    tenantId,
    patientName,
    medicineName: item.medicineName,
    instruction: item.labelText ?? item.dosageInstruction ?? '-',
    quantityText: String(item.qtyRequired),
  }));
};

const ensurePrescriptionProducts = async (
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  tenantId: string,
  items: z.infer<typeof prescriptionItemSchema>[]
) => {
  const productIds = [...new Set(items.map((item) => item.productId).filter((id): id is string => Boolean(id)))];
  if (!productIds.length) return;

  const products = await tx.product.findMany({
    where: { tenantId, id: { in: productIds } },
    select: { id: true },
  });
  if (products.length !== productIds.length) {
    throw new HttpError('One or more prescription products were not found for this tenant', 404, 'PRESCRIPTION_PRODUCT_NOT_FOUND');
  }
};

export const listPrescriptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const status = z.enum(['RECEIVED', 'PARTIALLY_REDEEMED', 'REDEEMED', 'CANCELLED']).optional().parse(req.query.status);
    const customerId = z.string().uuid().optional().parse(req.query.customerId);

    const prescriptions = await prisma.prescription.findMany({
      where: { tenantId, branchId, status, customerId },
      include: prescriptionInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return sendSuccess(res, prescriptions, 'Prescriptions retrieved', 200, { count: prescriptions.length });
  } catch (error) {
    return next(error);
  }
};

export const createPrescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const payload = prescriptionSchema.parse(req.body);

    const prescription = await prisma.$transaction(async (tx) => {
      const customer = payload.customerId
        ? await tx.customer.findFirstOrThrow({ where: { id: payload.customerId, tenantId } })
        : null;

      if (payload.doctorId) {
        await tx.doctor.findFirstOrThrow({ where: { id: payload.doctorId, tenantId } });
      }
      await ensurePrescriptionProducts(tx, tenantId, payload.items);

      const created = await tx.prescription.create({
        data: {
          tenantId,
          branchId,
          prescriptionNumber: payload.prescriptionNumber ?? prescriptionNumber(),
          source: payload.source,
          repeatType: payload.repeatType,
          repeatLimit: payload.repeatLimit,
          doctorId: payload.doctorId,
          customerId: payload.customerId,
          attachmentUrl: payload.attachmentUrl,
          notes: payload.notes,
          items: {
            create: payload.items.map((item) => ({
              tenantId,
              productId: item.productId,
              medicineName: item.medicineName,
              qtyRequired: item.qtyRequired,
              dosageInstruction: item.dosageInstruction,
              labelText: item.labelText,
              isCompounded: item.isCompounded,
            })),
          },
          labels: {
            create: createLabels(tenantId, customer?.name, payload.items),
          },
        },
        include: prescriptionInclude,
      });

      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'CREATE', entity: 'Prescription', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, prescription, 'Prescription created', 201);
  } catch (error) {
    return next(error);
  }
};

export const getPrescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const prescription = await prisma.prescription.findFirstOrThrow({
      where: { id, tenantId, branchId },
      include: prescriptionInclude,
    });

    return sendSuccess(res, prescription, 'Prescription retrieved');
  } catch (error) {
    return next(error);
  }
};

export const updatePrescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = updatePrescriptionSchema.parse(req.body);

    const prescription = await prisma.$transaction(async (tx) => {
      const before = await tx.prescription.findFirstOrThrow({
        where: { id, tenantId, branchId },
        include: prescriptionInclude,
      });

      if (payload.doctorId) {
        await tx.doctor.findFirstOrThrow({ where: { id: payload.doctorId, tenantId } });
      }
      const customer = payload.customerId
        ? await tx.customer.findFirstOrThrow({ where: { id: payload.customerId, tenantId } })
        : before.customer;

      if (payload.items) {
        await ensurePrescriptionProducts(tx, tenantId, payload.items);
        await tx.prescriptionItem.deleteMany({ where: { tenantId, prescriptionId: id } });
        await tx.prescriptionLabel.deleteMany({ where: { tenantId, prescriptionId: id } });
      }

      const updated = await tx.prescription.update({
        where: { id },
        data: {
          source: payload.source,
          status: payload.status,
          repeatType: payload.repeatType,
          repeatLimit: payload.repeatLimit,
          doctorId: payload.doctorId,
          customerId: payload.customerId,
          attachmentUrl: payload.attachmentUrl,
          notes: payload.notes,
          items: payload.items
            ? {
                create: payload.items.map((item) => ({
                  tenantId,
                  productId: item.productId,
                  medicineName: item.medicineName,
                  qtyRequired: item.qtyRequired,
                  dosageInstruction: item.dosageInstruction,
                  labelText: item.labelText,
                  isCompounded: item.isCompounded,
                })),
              }
            : undefined,
          labels: payload.items
            ? {
                create: createLabels(tenantId, customer?.name, payload.items),
              }
            : undefined,
        },
        include: prescriptionInclude,
      });

      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Prescription', entityId: id, before, after: updated, req }, tx);
      return updated;
    });

    return sendSuccess(res, prescription, 'Prescription updated');
  } catch (error) {
    return next(error);
  }
};

export const verifyPrescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const verifierId = req.auth?.userId;
    if (!verifierId) throw new HttpError('Authentication required', 401, 'UNAUTHENTICATED');

    const prescription = await prisma.$transaction(async (tx) => {
      const before = await tx.prescription.findFirstOrThrow({ where: { id, tenantId, branchId }, include: prescriptionInclude });
      const updated = await tx.prescription.update({
        where: { id },
        data: { verifiedById: verifierId },
        include: prescriptionInclude,
      });
      await auditLog({ tenantId, branchId, actorId: verifierId, action: 'APPROVE', entity: 'Prescription', entityId: id, before, after: updated, req }, tx);
      return updated;
    });

    return sendSuccess(res, prescription, 'Prescription verified');
  } catch (error) {
    return next(error);
  }
};

export const dispensePrescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = dispenseSchema.parse(req.body);

    const prescription = await prisma.$transaction(async (tx) => {
      const before = await tx.prescription.findFirstOrThrow({
        where: { id, tenantId, branchId },
        include: prescriptionInclude,
      });
      if (!before.verifiedById) {
        throw new HttpError('Prescription must be verified before dispensing', 409, 'PRESCRIPTION_NOT_VERIFIED');
      }
      if (before.status === 'REDEEMED' || before.status === 'CANCELLED') {
        throw new HttpError('Prescription cannot be dispensed in its current status', 409, 'PRESCRIPTION_NOT_DISPENSABLE');
      }

      const sale = await tx.sale.findFirstOrThrow({
        where: {
          id: payload.saleId,
          tenantId,
          branchId,
          status: 'COMPLETED',
          saleType: { in: ['PRESCRIPTION', 'COMPOUND'] },
        },
      });

      const redeemedCount = before.redeemedCount + 1;
      const status = before.repeatLimit && redeemedCount < before.repeatLimit ? 'PARTIALLY_REDEEMED' : 'REDEEMED';
      const updated = await tx.prescription.update({
        where: { id },
        data: {
          saleId: sale.id,
          redeemedCount,
          status,
          redeemedAt: status === 'REDEEMED' ? new Date() : before.redeemedAt,
          notes: payload.notes ?? before.notes,
        },
        include: prescriptionInclude,
      });

      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Prescription', entityId: id, before, after: updated, metadata: { saleId: sale.id }, req }, tx);
      return updated;
    });

    return sendSuccess(res, prescription, 'Prescription dispensed');
  } catch (error) {
    return next(error);
  }
};

export const prescriptionHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const customerId = z.string().uuid().optional().parse(req.query.customerId);

    const prescriptions = await prisma.prescription.findMany({
      where: {
        tenantId,
        branchId,
        customerId,
        status: { in: ['PARTIALLY_REDEEMED', 'REDEEMED', 'CANCELLED'] },
      },
      include: prescriptionInclude,
      orderBy: [{ redeemedAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return sendSuccess(res, prescriptions, 'Prescription history retrieved', 200, { count: prescriptions.length });
  } catch (error) {
    return next(error);
  }
};
