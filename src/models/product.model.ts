import { Schema, model, Model } from 'mongoose';
import type { Product, ProductCategory } from './types';
import { PRODUCT_CATEGORIES } from './types';

export interface ProductDocument extends Omit<Product, '_id'> {
  _id: string;
}

const productSchema = new Schema<ProductDocument>(
  {
    sku: {
      type: String,
      required: true,
      unique: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: PRODUCT_CATEGORIES as unknown as ProductCategory[],
    },
    price: { type: Number, required: true, min: 0 },
    rating: { type: Number, required: true, min: 0, max: 5 },
    stock: { type: Number, required: true, min: 0 },
    tags: { type: [String], default: [] },
    createdAt: { type: Date, default: () => new Date() },
  },
  {
    versionKey: false,
    collection: 'products',
  }
);

export const ProductModel: Model<ProductDocument> = model<ProductDocument>('Product', productSchema);