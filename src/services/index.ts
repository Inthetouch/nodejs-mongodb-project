export { ProductService } from './product.service';
export type { ListProductsParams, ListProductsResult } from './product.service';
export { OrderService } from './order.service';
export type { CreateOrderInput, ListOrdersParams, ListOrdersResult } from './order.service';
export { UserService } from './user.service';
export type { CreateUserInput } from './user.service';

import { ProductService } from './product.service';
import { OrderService } from './order.service';
import { UserService } from './user.service';
import { buildRepositories, type Repositories } from '../repositories';
import { buildCache } from '../cache';
import type { MetricsRegistry } from '../metrics/registry';

export interface Services {
  products: ProductService;
  orders: OrderService;
  users: UserService;
}

export interface BuildServicesOptions {
  repos?: Repositories;
  metrics?: MetricsRegistry;
}

export function buildServices(options: BuildServicesOptions = {}): Services {
  const repositories = options.repos ?? buildRepositories();
  const cache = buildCache({ metrics: options.metrics });

  return {
    products: new ProductService(repositories.products, cache),
    orders: new OrderService(repositories.orders, repositories.users, cache),
    users: new UserService(repositories.users, cache),
  };
}