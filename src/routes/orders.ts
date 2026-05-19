import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ORDER_STATUSES } from '../models/types';

const orderIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
  },
} as const;

const listOrdersQuerySchema = {
  type: 'object',
  properties: {
    userId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    status: { type: 'string', enum: [...ORDER_STATUSES] },
    createdAfter: { type: 'string', format: 'date-time' },
    createdBefore: { type: 'string', format: 'date-time' },
    page: { type: 'integer', minimum: 1, default: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
  additionalProperties: false,
} as const;

const createOrderBodySchema = {
  type: 'object',
  required: ['userId', 'items'],
  properties: {
    userId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 50,  // защита от слишком больших заказов
      items: {
        type: 'object',
        required: ['productId', 'productTitle', 'quantity', 'pricePerUnit'],
        properties: {
          productId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
          productTitle: { type: 'string', minLength: 1, maxLength: 500 },
          quantity: { type: 'integer', minimum: 1, maximum: 1000 },
          pricePerUnit: { type: 'number', minimum: 0 },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

export const ordersRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  app.get('/orders', {
    schema: { querystring: listOrdersQuerySchema },
  }, async (request) => {
    const query = request.query as {
      userId?: string;
      status?: any;
      createdAfter?: string;
      createdBefore?: string;
      page: number;
      pageSize: number;
    };

    const result = await app.services.orders.list({
      userId: query.userId,
      status: query.status,
      createdAfter: query.createdAfter ? new Date(query.createdAfter) : undefined,
      createdBefore: query.createdBefore ? new Date(query.createdBefore) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    });

    return result;
  });

  app.get('/orders/:id', {
    schema: { params: orderIdParamsSchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await app.services.orders.getById(id);

    if (order === null) {
      reply.code(404);
      return { error: 'Order not found', orderId: id };
    }

    return order;
  });

  app.post('/orders', {
    schema: { body: createOrderBodySchema },
  }, async (request, reply) => {
    const body = request.body as {
      userId: string;
      items: Array<{
        productId: string;
        productTitle: string;
        quantity: number;
        pricePerUnit: number;
      }>;
    };

    const created = await app.services.orders.create(body);

    reply.code(201);
    reply.header('Location', `/orders/${created._id}`);
    return created;
  });
};