import { Prisma } from '../generated/prisma/client';
import { HttpError } from '../utils/apiResponse';

export type SupervisorAction =
  | 'cancel_paid_trx'
  | 'discount_over_50'
  | 'return_over_sell'
  | 'sell_empty_stock'
  | 'delete_product_with_history'
  | 'edit_sell_price';

const actionPermissions: Record<SupervisorAction, string[]> = {
  cancel_paid_trx: ['sale.return'],
  discount_over_50: ['pos.checkout'],
  return_over_sell: ['sale.return'],
  sell_empty_stock: ['stock.adjust'],
  delete_product_with_history: ['product.manage'],
  edit_sell_price: ['product.manage'],
};

type AuthorizationContext = {
  tenantId: string;
  branchId: string;
  requestedById: string;
  action: SupervisorAction;
};

export const requiredPermissionsForSupervisorAction = (action: SupervisorAction) => actionPermissions[action];

export const assertSupervisorAuthorizations = async (
  tx: Prisma.TransactionClient,
  ids: string[],
  context: AuthorizationContext,
) => {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) throw new HttpError(`Supervisor authorization is required for ${context.action}`, 403, 'SUPERVISOR_AUTHORIZATION_REQUIRED');

  const records = await tx.supervisorAuthorization.findMany({
    where: {
      id: { in: uniqueIds },
      tenantId: context.tenantId,
      branchId: context.branchId,
      requestedById: context.requestedById,
      action: context.action,
      usedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      supervisor: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });

  if (records.length !== uniqueIds.length) {
    throw new HttpError(`Valid supervisor authorization is required for ${context.action}`, 403, 'SUPERVISOR_AUTHORIZATION_INVALID');
  }

  const required = new Set(actionPermissions[context.action]);
  for (const record of records) {
    const granted = new Set(record.supervisor.role.permissions.map((entry) => entry.permission.code));
    if (![...required].every((permission) => granted.has(permission))) {
      throw new HttpError('Supervisor does not have permission for this action', 403, 'SUPERVISOR_PERMISSION_DENIED');
    }
  }

  return records;
};

export const consumeSupervisorAuthorizations = async (
  tx: Prisma.TransactionClient,
  ids: string[],
  context: Pick<AuthorizationContext, 'tenantId' | 'branchId' | 'requestedById' | 'action'>,
) => {
  const result = await tx.supervisorAuthorization.updateMany({
    where: {
      id: { in: [...new Set(ids)] },
      tenantId: context.tenantId,
      branchId: context.branchId,
      requestedById: context.requestedById,
      action: context.action,
      usedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    data: { usedAt: new Date() },
  });
  if (result.count !== [...new Set(ids)].length) {
    throw new HttpError('Supervisor authorization was already consumed', 409, 'SUPERVISOR_AUTHORIZATION_CONSUMED');
  }
};
