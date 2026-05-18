import mongoose from 'mongoose';
import { config } from '../config';
import type { 
  ProductRepository, 
  UserRepository, 
  OrderRepository 
} from './types';

// Mongoose-реализации
import { MongooseProductRepository } from './mongoose/product.repository';
import { MongooseUserRepository } from './mongoose/user.repository';
import { MongooseOrderRepository } from './mongoose/order.repository';


import { NativeProductRepository } from './native/product.repository';

export type RepositoryImpl = 'mongoose' | 'native';

export interface Repositories {
  products: ProductRepository;
  users: UserRepository;
  orders: OrderRepository;
}

export function buildRepositories(override?: RepositoryImpl): Repositories {
  const impl: RepositoryImpl = 
    override ?? 
    (process.env.REPOSITORY_IMPL as RepositoryImpl) ?? 
    'mongoose';

  if (impl === 'mongoose') {
    return {
      products: new MongooseProductRepository(),
      users: new MongooseUserRepository(),
      orders: new MongooseOrderRepository(),
    };
  }

  if (impl === 'native') {

    const client = mongoose.connection.getClient();
    const db = client.db();

    return {
      products: new NativeProductRepository(db),
      users: new MongooseUserRepository(),
      orders: new MongooseOrderRepository(),
    };
  }

  throw new Error(`Unknown REPOSITORY_IMPL: ${impl}`);
}