import type { FilterQuery } from 'mongoose';
import { OrderModel, UserModel, type OrderDocument } from '../../models';
import type { Order, OrderItem } from '../../models/types';
import type {
  OrderRepository,
  OrderFilter,
  PaginationOptions,
} from '../types';
import { config } from '../../config';

function itemToDomain(item: any): OrderItem {
  return {
    productId: String(item.productId),
    productTitle: item.productTitle,
    quantity: item.quantity,
    pricePerUnit: item.pricePerUnit,
  };
}

function toDomain(doc: OrderDocument | (OrderDocument & { _id: any })): Order {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    status: doc.status,
    items: (doc.items ?? []).map(itemToDomain),
    totalAmount: doc.totalAmount,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    loadTestRun: doc.loadTestRun ?? false,
  };
}

function buildMongoFilter(filter: OrderFilter): FilterQuery<OrderDocument> {
  const query: FilterQuery<OrderDocument> = {};

  if (filter.userId !== undefined) {
    query.userId = filter.userId;
  }

  if (filter.status !== undefined) {
    query.status = filter.status;
  }

  if (filter.createdAfter !== undefined || filter.createdBefore !== undefined) {
    query.createdAt = {};
    if (filter.createdAfter !== undefined) {
      query.createdAt.$gte = filter.createdAfter;
    }
    if (filter.createdBefore !== undefined) {
      query.createdAt.$lte = filter.createdBefore;
    }
  }

  return query;
}

export class MongooseOrderRepository implements OrderRepository {

  async findById(id: string): Promise<Order | null> {
    const query = OrderModel.findById(id);
    const doc = config.experiment.useLean
      ? await query.lean<OrderDocument>().exec()
      : await query.exec();

    if (!doc) return null;
    return toDomain(doc as OrderDocument);
  }

  async findMany(
    filter: OrderFilter,
    pagination: PaginationOptions,
  ): Promise<{ items: Order[]; total: number }> {
    const mongoFilter = buildMongoFilter(filter);

    const dataQuery = OrderModel.find(mongoFilter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    const [docs, total] = await Promise.all([
      config.experiment.useLean
        ? dataQuery.lean<OrderDocument[]>().exec()
        : dataQuery.exec(),
      OrderModel.countDocuments(mongoFilter).exec(),
    ]);

    return {
      items: (docs as OrderDocument[]).map(toDomain),
      total,
    };
  }

  async create(data: Omit<Order, '_id'>): Promise<Order> {

    const doc = await OrderModel.create(data);

    await UserModel.updateOne(
      { _id: data.userId },
      { $inc: { ordersCount: 1 } }
    ).exec();

    return toDomain(doc.toObject() as OrderDocument);
  }
}