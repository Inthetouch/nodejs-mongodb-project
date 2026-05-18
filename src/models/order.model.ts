import { Schema, model, Model } from 'mongoose';
import type { Order, OrderItem, OrderStatus } from './types';
import { ORDER_STATUSES } from './types';

export interface OrderDocument extends Omit<Order, '_id'> {
  _id: string;
}

const orderItemSchema = new Schema<OrderItem>(
  {
  productId: { type: String, required: true },
  productTitle: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  pricePerUnit: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new Schema<OrderDocument>(
  {
    userId: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ORDER_STATUSES as unknown as OrderStatus[],
      default: 'pending',
    },
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: () => new Date() },
  },
  {
    versionKey: false,
    collection: 'orders',
  }
);

export const OrderModel: Model<OrderDocument> = model<OrderDocument>('Order', orderSchema);