import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { HttpError, sendError, sendSuccess } from '../../utils/apiResponse';
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
const branchUpdateSchema = branchSchema.partial();

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
const categoryUpdateSchema = categorySchema.partial();
const unitUpdateSchema = unitSchema.partial();

const rackSchema = z.object({
  branchId: z.string().uuid().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional(),
});
const rackUpdateSchema = rackSchema.omit({ branchId: true }).partial();

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
const supplierUpdateSchema = supplierSchema.partial();
const customerUpdateSchema = customerSchema.partial();
const doctorUpdateSchema = doctorSchema.partial();

const userSchema = z.object({
  branchId: z.string().uuid().optional(),
  roleId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  sipaNumber: z.string().optional(),
});

const updateUserSchema = userSchema.partial().extend({
  password: z.string().min(8).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
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

export const updateBranch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const id = z.string().uuid().parse(req.params.id);
    const payload = branchUpdateSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.branch.findFirstOrThrow({ where: { id, tenantId } });
      const updated = await tx.branch.update({ where: { id }, data: payload });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Branch', entityId: id, before, after: updated, req }, tx);
      return updated;
    });
    return sendSuccess(res, result, 'Branch updated');
  } catch (error) { return next(error); }
};

export const deleteBranch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const id = z.string().uuid().parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.branch.findFirstOrThrow({ where: { id, tenantId } });
      const activeUsers = await tx.user.count({ where: { tenantId, branchId: id, status: 'ACTIVE' } });
      if (activeUsers > 0) throw new HttpError('Branch still has active users', 409, 'BRANCH_IN_USE', { activeUsers });
      const updated = await tx.branch.update({ where: { id }, data: { status: 'INACTIVE' } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'DELETE', entity: 'Branch', entityId: id, before, after: updated, req }, tx);
      return { id, deleted: true, status: updated.status };
    });
    return sendSuccess(res, result, 'Branch deactivated');
  } catch (error) { return next(error); }
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

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const id = z.string().uuid().parse(req.params.id);
    const payload = categoryUpdateSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.category.findFirstOrThrow({ where: { id, tenantId } });
      const updated = await tx.category.update({ where: { id }, data: payload });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Category', entityId: id, before, after: updated, req }, tx);
      return updated;
    });
    return sendSuccess(res, result, 'Category updated');
  } catch (error) { return next(error); }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const id = z.string().uuid().parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.category.findFirstOrThrow({ where: { id, tenantId } });
      const productCount = await tx.product.count({ where: { tenantId, categoryId: id } });
      if (productCount > 0) throw new HttpError('Category is still used by products', 409, 'CATEGORY_IN_USE', { productCount });
      await tx.category.delete({ where: { id } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'DELETE', entity: 'Category', entityId: id, before, req }, tx);
      return { id, deleted: true };
    });
    return sendSuccess(res, result, 'Category deleted');
  } catch (error) { return next(error); }
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

export const updateUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const id = z.string().uuid().parse(req.params.id);
    const payload = unitUpdateSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.unit.findFirstOrThrow({ where: { id, tenantId } });
      const updated = await tx.unit.update({ where: { id }, data: payload });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Unit', entityId: id, before, after: updated, req }, tx);
      return updated;
    });
    return sendSuccess(res, result, 'Unit updated');
  } catch (error) { return next(error); }
};

export const deleteUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const id = z.string().uuid().parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.unit.findFirstOrThrow({ where: { id, tenantId } });
      const productUnitCount = await tx.productUnit.count({ where: { unitId: id, product: { tenantId } } });
      if (productUnitCount > 0) throw new HttpError('Unit is still used by products', 409, 'UNIT_IN_USE', { productUnitCount });
      await tx.unit.delete({ where: { id } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'DELETE', entity: 'Unit', entityId: id, before, req }, tx);
      return { id, deleted: true };
    });
    return sendSuccess(res, result, 'Unit deleted');
  } catch (error) { return next(error); }
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

export const updateRack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const id = z.string().uuid().parse(req.params.id);
    const payload = rackUpdateSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.stockLocation.findFirstOrThrow({ where: { id, tenantId, branchId } });
      const updated = await tx.stockLocation.update({ where: { id }, data: payload });
      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'StockLocation', entityId: id, before, after: updated, req }, tx);
      return updated;
    });
    return sendSuccess(res, result, 'Rack updated');
  } catch (error) { return next(error); }
};

export const deleteRack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const id = z.string().uuid().parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.stockLocation.findFirstOrThrow({ where: { id, tenantId, branchId } });
      const batchCount = await tx.productBatch.count({ where: { tenantId, branchId, locationId: id } });
      if (batchCount > 0) throw new HttpError('Rack is still used by stock batches', 409, 'RACK_IN_USE', { batchCount });
      await tx.stockLocation.delete({ where: { id } });
      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'DELETE', entity: 'StockLocation', entityId: id, before, req }, tx);
      return { id, deleted: true };
    });
    return sendSuccess(res, result, 'Rack deleted');
  } catch (error) { return next(error); }
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

export const updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req); const id = z.string().uuid().parse(req.params.id); const payload = supplierUpdateSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => { const before = await tx.supplier.findFirstOrThrow({ where: { id, tenantId } }); const updated = await tx.supplier.update({ where: { id }, data: payload }); await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Supplier', entityId: id, before, after: updated, req }, tx); return updated; });
    return sendSuccess(res, result, 'Supplier updated');
  } catch (error) { return next(error); }
};

export const deleteSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req); const id = z.string().uuid().parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => { const before = await tx.supplier.findFirstOrThrow({ where: { id, tenantId } }); const [products, purchases, prices] = await Promise.all([tx.product.count({ where: { tenantId, defaultSupplierId: id } }), tx.purchase.count({ where: { tenantId, supplierId: id } }), tx.supplierProductPrice.count({ where: { tenantId, supplierId: id } })]); if (products + purchases + prices > 0) throw new HttpError('Supplier is still referenced by operational data', 409, 'SUPPLIER_IN_USE', { products, purchases, prices }); await tx.supplier.delete({ where: { id } }); await auditLog({ tenantId, actorId: req.auth?.userId, action: 'DELETE', entity: 'Supplier', entityId: id, before, req }, tx); return { id, deleted: true }; });
    return sendSuccess(res, result, 'Supplier deleted');
  } catch (error) { return next(error); }
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

export const updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req); const id = z.string().uuid().parse(req.params.id); const payload = customerUpdateSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => { const before = await tx.customer.findFirstOrThrow({ where: { id, tenantId } }); const updated = await tx.customer.update({ where: { id }, data: payload }); await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Customer', entityId: id, before, after: updated, req }, tx); return updated; });
    return sendSuccess(res, result, 'Customer updated');
  } catch (error) { return next(error); }
};

export const deleteCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req); const id = z.string().uuid().parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => { const before = await tx.customer.findFirstOrThrow({ where: { id, tenantId } }); const [sales, prescriptions, receivables, records] = await Promise.all([tx.sale.count({ where: { tenantId, customerId: id } }), tx.prescription.count({ where: { tenantId, customerId: id } }), tx.receivable.count({ where: { tenantId, customerId: id } }), tx.medicalRecord.count({ where: { tenantId, customerId: id } })]); if (sales + prescriptions + receivables + records > 0) throw new HttpError('Customer is still referenced by operational data', 409, 'CUSTOMER_IN_USE', { sales, prescriptions, receivables, records }); await tx.customer.delete({ where: { id } }); await auditLog({ tenantId, actorId: req.auth?.userId, action: 'DELETE', entity: 'Customer', entityId: id, before, req }, tx); return { id, deleted: true }; });
    return sendSuccess(res, result, 'Customer deleted');
  } catch (error) { return next(error); }
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

export const updateDoctor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req); const id = z.string().uuid().parse(req.params.id); const payload = doctorUpdateSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => { const before = await tx.doctor.findFirstOrThrow({ where: { id, tenantId } }); const updated = await tx.doctor.update({ where: { id }, data: payload }); await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Doctor', entityId: id, before, after: updated, req }, tx); return updated; });
    return sendSuccess(res, result, 'Doctor updated');
  } catch (error) { return next(error); }
};

export const deleteDoctor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req); const id = z.string().uuid().parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => { const before = await tx.doctor.findFirstOrThrow({ where: { id, tenantId } }); const prescriptionCount = await tx.prescription.count({ where: { tenantId, doctorId: id } }); if (prescriptionCount > 0) throw new HttpError('Doctor is still referenced by prescriptions', 409, 'DOCTOR_IN_USE', { prescriptionCount }); await tx.doctor.delete({ where: { id } }); await auditLog({ tenantId, actorId: req.auth?.userId, action: 'DELETE', entity: 'Doctor', entityId: id, before, req }, tx); return { id, deleted: true }; });
    return sendSuccess(res, result, 'Doctor deleted');
  } catch (error) { return next(error); }
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
    await prisma.role.findFirstOrThrow({ where: { id: payload.roleId, tenantId } });
    if (payload.branchId) {
      await prisma.branch.findFirstOrThrow({ where: { id: payload.branchId, tenantId } });
    }
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

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const userId = z.string().uuid().parse(req.params.id);
    const payload = updateUserSchema.parse(req.body);
    const before = await prisma.user.findFirstOrThrow({ where: { id: userId, tenantId }, select: { id: true, tenantId: true, branchId: true, roleId: true, name: true, email: true, phone: true, sipaNumber: true, status: true } });
    if (payload.roleId) await prisma.role.findFirstOrThrow({ where: { id: payload.roleId, tenantId } });
    if (payload.branchId) await prisma.branch.findFirstOrThrow({ where: { id: payload.branchId, tenantId } });
    const passwordHash = payload.password ? await bcrypt.hash(payload.password, 12) : undefined;
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: userId },
        data: { branchId: payload.branchId, roleId: payload.roleId, name: payload.name, phone: payload.phone, sipaNumber: payload.sipaNumber, status: payload.status, passwordHash },
        select: { id: true, tenantId: true, branchId: true, roleId: true, name: true, email: true, phone: true, sipaNumber: true, status: true, role: true, branch: true },
      });
      await auditLog({ tenantId, branchId: result.branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'User', entityId: userId, before, after: result, req }, tx);
      return result;
    });
    return sendSuccess(res, updated, 'User updated');
  } catch (error) { return next(error); }
};

export const deactivateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const userId = z.string().uuid().parse(req.params.id);
    if (userId === req.auth?.userId) return sendError(res, 'The current user cannot be deactivated', 400, undefined, 'SELF_DEACTIVATION_DENIED');
    const before = await prisma.user.findFirstOrThrow({ where: { id: userId, tenantId }, select: { id: true, tenantId: true, branchId: true, roleId: true, name: true, email: true, phone: true, sipaNumber: true, status: true } });
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({ where: { id: userId }, data: { status: 'INACTIVE' }, select: { id: true, tenantId: true, branchId: true, roleId: true, name: true, email: true, phone: true, sipaNumber: true, status: true } });
      await auditLog({ tenantId, branchId: result.branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'User', entityId: userId, before, after: result, metadata: { deactivated: true }, req }, tx);
      return result;
    });
    return sendSuccess(res, updated, 'User deactivated');
  } catch (error) { return next(error); }
};
