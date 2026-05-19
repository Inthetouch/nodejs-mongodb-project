import type { FilterQuery } from 'mongoose';
import { ProductModel, type ProductDocument } from '../../models';
import type { Product } from '../../models/types';
import type { 
  ProductRepository,
  ProductFilter,
  ProductSortOption,
  PaginationOptions
} from '../types';
import { config } from '../../config';

function toDomain(doc: ProductDocument | (ProductDocument & { _id: any })): Product {
  return {
    _id: String(doc._id),
    title: doc.title,
    description: doc.description,
    category: doc.category,
    price: doc.price,
    rating: doc.rating,
    stock: doc.stock,
    tags: doc.tags ?? [],
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
  };
}

function buildMongoFilter(filter: ProductFilter): FilterQuery<ProductDocument> {
  const query: FilterQuery<ProductDocument> = {};

  if (filter.category !== undefined) {
    query.category = filter.category;
  }

  if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
    query.price = {};
    if (filter.minPrice !== undefined) query.price.$gte = filter.minPrice;
    if (filter.maxPrice !== undefined) query.price.$lte = filter.maxPrice;
  }

  if (filter.minRating !== undefined) {
    query.rating = { $gte: filter.minRating };
  }

  if (filter.inStock === true) {
    query.stock = { $gt: 0 };
  }

  if (filter.search !== undefined && filter.search.trim().length > 0) {
    query.$text = { $search: filter.search };
  }

  return query;
}

export class MongooseProductRepository implements ProductRepository {
  async findById(id: string): Promise<Product | null> {
    const query = ProductModel.findById(id);
    const doc = config.experiment.useLean ? await query.lean<ProductDocument>().exec() : await query.exec();

    if (!doc) return null;
    return toDomain(doc as ProductDocument);
  }

  async findMany(
    filter: ProductFilter,
    pagination: PaginationOptions,
    sort?: ProductSortOption,
  ): Promise<{ items: Product[]; total: number }> {
    const mongoFilter = buildMongoFilter(filter);

    const sortSpec: Record<string, 1 | -1> = sort
      ? { [sort.field]: sort.direction === 'asc' ? 1 : -1 }
      : { createdAt: -1 };
      
    const dataQuery = ProductModel.find(mongoFilter)
      .sort(sortSpec)
      .skip(pagination.skip)
      .limit(pagination.limit);

    const [docs, total] = await Promise.all([
      config.experiment.useLean
        ? dataQuery.lean<ProductDocument[]>().exec()
        : dataQuery.exec(),
      ProductModel.countDocuments(mongoFilter).exec(),
    ]);

    return {
      items: (docs as ProductDocument[]).map(toDomain),
      total,
    };
  }

  async create(data: Omit<Product, '_id'>): Promise<Product> {
    const doc = await ProductModel.create(data);
    return toDomain(doc.toObject() as ProductDocument);
  }

  async updateById(
    id: string,
    patch: Partial<Omit<Product, '_id'>>,
  ): Promise<Product | null> {
    const updated = await ProductModel.findByIdAndUpdate(id, patch, { 
      new: true,
      lean: config.experiment.useLean 
    }).exec();
    
    if (!updated) return null;
    return toDomain(updated as ProductDocument);
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await ProductModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}