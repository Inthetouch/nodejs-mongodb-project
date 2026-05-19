import type { UserRepository } from '../repositories/types';
import type { User, UserStatus } from '../models/types';
import type { CacheService } from '../cache';
import { config } from '../config';

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  status?: UserStatus;
}

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly cache: CacheService,
  ) {}

  async getById(id: string): Promise<User | null> {
    const cacheKey = `user:v1:${id}`;
    return this.cache.getOrLoad<User>(
      cacheKey,
      config.experiment.cacheTtlSeconds,
      () => this.users.findById(id),
    );
  }

  async getByEmail(email: string): Promise<User | null> {
    const cacheKey = `user:v1:email:${email.toLowerCase()}`;
    return this.cache.getOrLoad<User>(
      cacheKey,
      config.experiment.cacheTtlSeconds,
      () => this.users.findByEmail(email),
    );
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.users.create({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      status: input.status ?? 'active',
      createdAt: new Date(),
    });
  }
}