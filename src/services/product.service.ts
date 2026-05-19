import type { ProductRepository, ProductFilter, ProductSortOption, PaginationOptions } from "../repositories/types";
import type { Product, ProductCategory } from "../models/types";

export interface ListProductsParams {
  category?: ProductCategory;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  search?: string;
  page: number;
  pageSize: number;
  sortField?: 'createdAt' | 'price' | 'rating';
  sortDirection?: 'asc' | 'desc';
}

export interface ListProductsResult {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ProductService {
  constructor(private readonly products: ProductRepository) {}

  async getById(id: string): Promise<Product | null> {
    return this.products.findById(id);
  }

  async list(params: ListProductsParams): Promise<ListProductsResult> {
    
    const safePage = Math.max(1, params.page);
    const skip = (safePage - 1) * params.pageSize;

    const filter: ProductFilter = {
      category: params.category,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minRating: params.minRating,
      inStock: params.inStock,
      search: params.search,
    };

    const sort: ProductSortOption | undefined = params.sortField
      ? { field: params.sortField, direction: params.sortDirection ?? 'desc' }
      : undefined;

      const pagination: PaginationOptions = {
      skip,
      limit: params.pageSize,
    };

    const result = await this.products.findMany(filter, pagination, sort);
    const totalPages = Math.ceil(result.total / params.pageSize);

    return {
      items: result.items,
      total: result.total,
      page: safePage,
      pageSize: params.pageSize,
      totalPages,
    };
  }
}