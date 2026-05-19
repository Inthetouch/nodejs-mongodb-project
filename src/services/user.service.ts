import type { UserRepository } from '../repositories/types';
import type { User, UserStatus } from '../models/types';

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  status?: UserStatus;
}

export class UserService {
  constructor(private readonly users: UserRepository) {}

  async getById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email);
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