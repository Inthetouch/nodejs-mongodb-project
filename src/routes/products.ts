import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PRODUCT_CATEGORIES } from '../models/types';

const listProductsQuerySchema = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      enum: [...PRODUCT_CATEGORIES],
    },
    minPrice: { type: 'number', minimum: 0 },
    maxPrice: { type: 'number', minimum: 0 },
    minRating: { type: 'number', minimum: 0, maximum: 5 },
    inStock: { type: 'boolean' },
    search: { type: 'string', minLength: 1, maxLength: 200 },
    page: { type: 'integer', minimum: 1, default: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    sortField: {
      type: 'string',
      enum: ['createdAt', 'price', 'rating'],
    },
    sortDirection: {
      type: 'string',
      enum: ['asc', 'desc'],
    },
  },
  additionalProperties: false,
} as const;

const productIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
  },
} as const;

export const productsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/products', {
    schema: {
      querystring: listProductsQuerySchema,
    },
  }, async (request) => {
    const query = request.query as {
      category?: string;
      minPrice?: number;
      maxPrice?: number;
      minRating?: number;
      inStock?: boolean;
      search?: string;
      page: number;
      pageSize: number;
      sortField?: 'createdAt' | 'price' | 'rating';
      sortDirection?: 'asc' | 'desc';
    };
    
    const result = await app.services.products.list({
      category: query.category as any,  // приводим к ProductCategory, поскольку JSON Schema enum уже проверил
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      minRating: query.minRating,
      inStock: query.inStock,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sortField,
      sortDirection: query.sortDirection,
    });

    return result;
  });

  app.get('/products/:id', {
    schema: {
      params: productIdParamsSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await app.services.products.getById(id);

    if (product === null) {
      reply.code(404);
      return { error: 'Product not found', productId: id };
    }

    return product;
  });
};