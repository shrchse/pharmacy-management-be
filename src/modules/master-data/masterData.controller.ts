import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../utils/apiResponse';
import { getBranchId, getTenantId } from '../../utils/scope';

const branchSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  businessCategory: z.enum(['APOTEK', 'TOKO_OBAT', 'KLINIK', 'PBF', 'DISTRIBUTOR']).default('APOTEK'),
  phone: z.string().optional(),
  address: z.string().optional(),
  siaNumber: z.string().optional(),
  apjName: z.string().optional(),
  apjSipaNumber: z.string().optional(),
});

const categorySchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    'OBAT_BEBAS',
    'OBAT_BEBAS_TERBATAS',
    'OBAT_KERAS',
    'PSIKOTROPIKA',
    'NARKOTIKA',
    'ALKES',
    'BMHP',
    'KOSMETIK',
    'UMUM',
  ]).default('OBAT_BEBAS'),
});

const unitSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

const rackSchema = z.object({
  branchId: z.string().uuid().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional(),
});

const supplierSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(['PBF', 'DISTRIBUTOR', 'CONSIGNOR', 'GENERAL']).default('PBF'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  contactPerson: z.string().optional(),
});

const customerSchema = z.object({
  memberNo: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  birthDate: z.coerce.date().optional(),
  gender: z.string().optional(),
});

const doctorSchema = z.object({
  name: z.string().min(1),
  sipNumber: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const userSchema = z.object({
  branchId: z.string().uuid().optional(),
  roleId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  sipaNumber: z.string().optional(),
});

const createdMeta = (resource: string) => `${resource} created`;

export const listBranches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branches = await prisma.branch.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, branches, 'Branches retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createBranch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = branchSchema.parse(req.body);
    const branch = await prisma.$transaction(async (tx) => {
      const created = await tx.branch.create({ data: { tenantId, ...payload } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'CREATE', entity: 'Branch', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, branch, createdMeta('Branch'), 201);
  } catch (error) {
    return next(error);
  }
};

export const listCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const categories = await prisma.category.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
    return sendSuccess(res, categories, 'Categories retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = categorySchema.parse(req.body);
    const category = await prisma.$transaction(async (tx) => {
      const created = await tx.category.create({ data: { tenantId, ...payload } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'CREATE', entity: 'Category', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, category, createdMeta('Category'), 201);
  } catch (error) {
    return next(error);
  }
};

export const listUnits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const units = await prisma.unit.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
    return sendSuccess(res, units, 'Units retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = unitSchema.parse(req.body);
    const unit = await prisma.$transaction(async (tx) => {
      const created = await tx.unit.create({ data: { tenantId, ...payload } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'CREATE', entity: 'Unit', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, unit, createdMeta('Unit'), 201);
  } catch (error) {
    return next(error);
  }
};

export const listRacks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const racks = await prisma.stockLocation.findMany({
      where: { tenantId, branchId },
      orderBy: { code: 'asc' },
    });

    return sendSuccess(res, racks, 'Racks retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createRack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = rackSchema.parse(req.body);
    const branchId = payload.branchId ?? getBranchId(req);
    const rack = await prisma.$transaction(async (tx) => {
      const created = await tx.stockLocation.create({
        data: {
          tenantId,
          branchId,
          code: payload.code,
          name: payload.name,
          type: payload.type ?? 'RACK',
        },
      });
      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'CREATE', entity: 'StockLocation', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, rack, createdMeta('Rack'), 201);
  } catch (error) {
    return next(error);
  }
};

export const listSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const suppliers = await prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
    return sendSuccess(res, suppliers, 'Suppliers retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = supplierSchema.parse(req.body);
    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({ data: { tenantId, ...payload } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'CREATE', entity: 'Supplier', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, supplier, createdMeta('Supplier'), 201);
  } catch (error) {
    return next(error);
  }
};

export const listCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const customers = await prisma.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
    return sendSuccess(res, customers, 'Customers retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = customerSchema.parse(req.body);
    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({ data: { tenantId, ...payload } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'CREATE', entity: 'Customer', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, customer, createdMeta('Customer'), 201);
  } catch (error) {
    return next(error);
  }
};

export const listDoctors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const doctors = await prisma.doctor.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
    return sendSuccess(res, doctors, 'Doctors retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createDoctor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = doctorSchema.parse(req.body);
    const doctor = await prisma.$transaction(async (tx) => {
      const created = await tx.doctor.create({ data: { tenantId, ...payload } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'CREATE', entity: 'Doctor', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, doctor, createdMeta('Doctor'), 201);
  } catch (error) {
    return next(error);
  }
};

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const users = await prisma.user.findMany({
      where: { tenantId },
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
        lastLoginAt: true,
        role: true,
        branch: true,
      },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, users, 'Users retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = userSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId,
          branchId: payload.branchId,
          roleId: payload.roleId,
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          passwordHash,
          sipaNumber: payload.sipaNumber,
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
          role: true,
          branch: true,
        },
      });
      await auditLog({ tenantId, branchId: created.branchId, actorId: req.auth?.userId, action: 'CREATE', entity: 'User', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, user, createdMeta('User'), 201);
  } catch (error) {
    return next(error);
  }
};
