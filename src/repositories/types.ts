import type { Product, ProductCategory, User, Order, OrderStatus } from "../models/types";

export interface PaginationOptions {
  skip: number;
  limit: number;
}

export interface ProductFilter {
  category?: ProductCategory;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  search?: string;
}

export interface ProductSortOption {
  field: 'createdAt' | 'price' | 'rating';
  order: 'asc' | 'desc';
}

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;

  findMany(
    filter: ProductFilter, 
    pagination: PaginationOptions,
    sort?: ProductSortOption,
  ): Promise<{ items: Product[]; total: number }>;

  create(data: Omit<Product, '_id'>): Promise<Product>;

  updateById(id: string, patch: Partial<Omit<Product, '_id'>>): Promise<Product | null>;

  deleteById(id: string): Promise<boolean>;
}

export interface OrderFilter {
  userId?: string;
  status?: OrderStatus;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findMany(
    filter: OrderFilter,
    pagination: PaginationOptions,
  ): Promise<{ items: Order[]; total: number }>;
  create(data: Omit<Order, '_id'>): Promise<Order>;
}