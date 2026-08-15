import { Request } from 'express';
import { z } from 'zod';
import { resolveBranchId, resolveTenantId } from '../middlewares/auth.middleware';

const tenantSchema = z.string({ required_error: 'tenantId is required' }).uuid('tenantId must be a valid UUID');
const branchSchema = z.string({ required_error: 'branchId is required' }).uuid('branchId must be a valid UUID');

export const getTenantId = (req: Request) => tenantSchema.parse(resolveTenantId(req));

export const getBranchId = (req: Request) => branchSchema.parse(resolveBranchId(req));

export const getOptionalBranchId = (req: Request) => {
  const branchId = resolveBranchId(req);
  return branchId ? branchSchema.parse(branchId) : undefined;
};
