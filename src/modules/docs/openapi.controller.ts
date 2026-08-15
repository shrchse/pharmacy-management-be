import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';

const successResponse = (schemaRef = '#/components/schemas/SuccessResponse') => ({
  description: 'Successful response',
  content: {
    'application/json': {
      schema: { $ref: schemaRef },
    },
  },
});

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'SIM Apotek Backend API',
    version: '1.0.0',
    description: 'Phase 0 and Phase 1 API contract for SIM Apotek backend.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          data: {},
          meta: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': { get: { security: [], responses: { 200: successResponse() } } },
    '/auth/bootstrap': { post: { security: [], responses: { 201: successResponse() } } },
    '/auth/login': { post: { security: [], responses: { 200: successResponse() } } },
    '/auth/logout': { post: { responses: { 200: successResponse() } } },
    '/auth/refresh': { post: { responses: { 200: successResponse() } } },
    '/auth/me': { get: { responses: { 200: successResponse() } } },
    '/tenants/active': { get: { responses: { 200: successResponse() } } },
    '/internal/tenants': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/outlets': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/branches': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/categories': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/units': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/racks': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/suppliers': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/customers': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/doctors': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/users': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/products': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/products/search': { get: { responses: { 200: successResponse() } } },
    '/products/{id}': { get: { responses: { 200: successResponse() } }, patch: { responses: { 200: successResponse() } }, delete: { responses: { 200: successResponse() } } },
    '/products/{id}/batches': { get: { responses: { 200: successResponse() } } },
    '/stock/overview': { get: { responses: { 200: successResponse() } } },
    '/stock/defekta': { get: { responses: { 200: successResponse() } } },
    '/stock/reminder-ed': { get: { responses: { 200: successResponse() } } },
    '/products/{id}/stock-card': { get: { responses: { 200: successResponse() } } },
    '/stock/batches': { post: { responses: { 201: successResponse() } } },
    '/cashier-shifts/open': { post: { responses: { 201: successResponse() } } },
    '/cashier-shifts/{id}': { get: { responses: { 200: successResponse() } } },
    '/cashier-shifts/{id}/close': { post: { responses: { 200: successResponse() } } },
    '/cashier-shifts/{id}/deposit': { post: { responses: { 200: successResponse() } } },
    '/cashier-shifts/{id}/verify': { post: { responses: { 200: successResponse() } } },
    '/pos/checkout': { post: { responses: { 201: successResponse(), 200: successResponse(), 409: { description: 'Idempotency or stock conflict' } } } },
    '/transactions': { get: { responses: { 200: successResponse() } } },
    '/transactions/{id}': { get: { responses: { 200: successResponse() } } },
    '/transactions/{id}/cancel': { post: { responses: { 200: successResponse() } } },
    '/receipts/{transactionId}': { get: { responses: { 200: successResponse() } } },
    '/purchase-orders/apj-pin': { post: { responses: { 200: successResponse() } } },
    '/purchase-orders': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/purchase-orders/{id}': { get: { responses: { 200: successResponse() } } },
    '/purchase-orders/{id}/submit-approval': { post: { responses: { 201: successResponse() } } },
    '/purchase-orders/{id}/approve-apj': { post: { responses: { 200: successResponse() } } },
    '/purchase-orders/{id}/receive': { post: { responses: { 200: successResponse() } } },
    '/invoices': { get: { responses: { 200: successResponse() } } },
    '/purchase-returns': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/cash': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/cash/mutations': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/debts': { get: { responses: { 200: successResponse() } } },
    '/debts/{id}/pay': { post: { responses: { 200: successResponse() } } },
    '/receivables': { get: { responses: { 200: successResponse() } } },
    '/receivables/{id}/pay': { post: { responses: { 200: successResponse() } } },
    '/expenses': { post: { responses: { 201: successResponse() } } },
    '/finance/pnl': { get: { responses: { 200: successResponse() } } },
    '/finance/cash-flow': { get: { responses: { 200: successResponse() } } },
    '/finance/balance-sheet': { get: { responses: { 200: successResponse() } } },
    '/finance/ratios': { get: { responses: { 200: successResponse() } } },
    '/finance/aging-debts': { get: { responses: { 200: successResponse() } } },
    '/finance/aging-receivables': { get: { responses: { 200: successResponse() } } },
    '/licenses': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/licenses/{id}': { patch: { responses: { 200: successResponse() } } },
    '/licenses/alerts': { get: { responses: { 200: successResponse() } } },
    '/practitioner-licenses': { get: { responses: { 200: successResponse() } }, post: { responses: { 201: successResponse() } } },
    '/practitioner-licenses/{id}': { patch: { responses: { 200: successResponse() } } },
  },
};

export const getOpenApi = (_req: Request, res: Response) => {
  return res.json(openApiDocument);
};

export const docsIndex = (_req: Request, res: Response) => {
  return sendSuccess(res, {
    openapi: 'GET /api/v1/docs/openapi.json',
  }, 'API documentation endpoints');
};
