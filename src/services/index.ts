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

export interface Services {
  products: ProductService;
  orders: OrderService;
  users: UserService;
}

export function buildServices(repos?: Repositories): Services {
  const repositories = repos ?? buildRepositories();

  return {
    products: new ProductService(repositories.products),
    orders: new OrderService(repositories.orders, repositories.users),
    users: new UserService(repositories.users),
  };
}