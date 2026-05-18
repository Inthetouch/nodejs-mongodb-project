import { type Db, type Collection, ObjectId, type Filter, type Sort } from 'mongodb';
import type { Product } from '../../models/types';
import type {
  ProductRepository,
  ProductFilter,
  ProductSortOption,
  PaginationOptions,
} from '../types';

interface ProductDoc {
  _id: ObjectId;
  title: string;
  description: string;
  category: string;
  price: number;
  rating: number;
  stock: number;
  tags: string[];
  createdAt: Date;
}

function toDomain(doc: ProductDoc): Product {
  return {
    _id: doc._id.toHexString(),
    title: doc.title,
    description: doc.description,
    category: doc.category as Product['category'],
    price: doc.price,
    rating: doc.rating,
    stock: doc.stock,
    tags: doc.tags ?? [],
    createdAt: doc.createdAt,
  };
}

function buildMongoFilter(filter: ProductFilter): Filter<ProductDoc> {

  const query: Filter<ProductDoc> = {};

  if (filter.category !== undefined) query.category = filter.category;

  if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
    query.price = {};
    if (filter.minPrice !== undefined) (query.price as any).$gte = filter.minPrice;
    if (filter.maxPrice !== undefined) (query.price as any).$lte = filter.maxPrice;
  }

  if (filter.minRating !== undefined) query.rating = { $gte: filter.minRating };
  if (filter.inStock === true) query.stock = { $gt: 0 };
  if (filter.search !== undefined && filter.search.trim().length > 0) {
    (query as any).$text = { $search: filter.search };
  }

  return query;
}

export class NativeProductRepository implements ProductRepository {
  private readonly collection: Collection<ProductDoc>;

  constructor(db: Db) {
    this.collection = db.collection<ProductDoc>('products');
  }

  async findById(id: string): Promise<Product | null> {

    if (!ObjectId.isValid(id)) return null;

    const doc = await this.collection.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return toDomain(doc);
  }

  async findMany(
    filter: ProductFilter,
    pagination: PaginationOptions,
    sort?: ProductSortOption,
  ): Promise<{ items: Product[]; total: number }> {
    const mongoFilter = buildMongoFilter(filter);

    const sortSpec: Sort = sort
      ? { [sort.field]: sort.direction === 'asc' ? 1 : -1 }
      : { createdAt: -1 };

    const [docs, total] = await Promise.all([
      this.collection
        .find(mongoFilter)
        .sort(sortSpec)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .toArray(),
      this.collection.countDocuments(mongoFilter),
    ]);

    return {
      items: docs.map(toDomain),
      total,
    };
  }

  async create(data: Omit<Product, '_id'>): Promise<Product> {
    // insertOne автоматически генерирует ObjectId и подмешивает его в документ.
    const result = await this.collection.insertOne({
      ...data,
      _id: new ObjectId(),
    } as ProductDoc);

    const created = await this.collection.findOne({ _id: result.insertedId });
    if (!created) throw new Error('Failed to retrieve just-created product');
    return toDomain(created);
  }

  async updateById(
    id: string,
    patch: Partial<Omit<Product, '_id'>>,
  ): Promise<Product | null> {
    if (!ObjectId.isValid(id)) return null;

    const updated = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: patch },
      { returnDocument: 'after' },
    );

    if (!updated) return null;
    return toDomain(updated);
  }

  async deleteById(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }
}