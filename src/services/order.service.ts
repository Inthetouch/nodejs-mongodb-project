import type { OrderRepository, UserRepository, OrderFilter, PaginationOptions } from '../repositories/types';
import type { Order, OrderItem, OrderStatus } from '../models/types';

export interface CreateOrderInput {
  userId: string;
  items: Array<{
    productId: string;
    productTitle: string;
    quantity: number;
    pricePerUnit: number;
  }>;
}

export interface ListOrdersParams {
  userId?: string;
  status?: OrderStatus;
  createdAfter?: Date;
  createdBefore?: Date;
  page: number;
  pageSize: number;
}

export interface ListOrdersResult {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly users: UserRepository,
  ) {}

  async getById(id: string): Promise<Order | null> {
    return this.orders.findById(id);
  }

  async list(params: ListOrdersParams): Promise<ListOrdersResult> {
    const safePage = Math.max(1, params.page);
    const skip = (safePage - 1) * params.pageSize;

    const filter: OrderFilter = {
      userId: params.userId,
      status: params.status,
      createdAfter: params.createdAfter,
      createdBefore: params.createdBefore,
    };

    const result = await this.orders.findMany(filter, { skip, limit: params.pageSize });
    const totalPages = Math.ceil(result.total / params.pageSize);

    return {
      items: result.items,
      total: result.total,
      page: safePage,
      pageSize: params.pageSize,
      totalPages,
    };
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const status: OrderStatus = 'pending';

    const totalAmount = input.items.reduce(
      (sum, item) => sum + item.pricePerUnit * item.quantity,
      0,
    );
    const roundedTotal = Math.round(totalAmount * 100) / 100;

    const items: OrderItem[] = input.items.map(item => ({
      productId: item.productId,
      productTitle: item.productTitle,
      quantity: item.quantity,
      pricePerUnit: item.pricePerUnit,
    }));

    const created = await this.orders.create({
      userId: input.userId,
      status,
      items,
      totalAmount: roundedTotal,
      createdAt: new Date(),
    });

    return created;
  }
}