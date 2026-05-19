export type EntityId = string;

export const PRODUCT_CATEGORIES = [
  'electronics', 'clothing', 'books', 'home', 'sports',
  'beauty', 'food', 'toys', 'auto', 'other',
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const USER_STATUSES = ['active', 'inactive', 'banned'] as const;
export type UserStatus = typeof USER_STATUSES[number];

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export interface User {
  _id: EntityId;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  createdAt: Date;
  ordersCount: number;
}

export interface Product {
  _id: EntityId;
  sku: string;
  title: string;
  description: string;
  category: ProductCategory;
  price: number;
  rating: number;
  stock: number;
  tags: string[];
  createdAt: Date;
}

export interface OrderItem {
  productId: EntityId;
  productTitle: string;
  quantity: number;
  pricePerUnit: number;
}

export interface Order {
  _id: EntityId;
  userId: EntityId;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  createdAt: Date;
}