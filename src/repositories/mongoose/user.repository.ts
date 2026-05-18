import { UserModel, type UserDocument } from '../../models';
import type { User } from '../../models/types';
import type { UserRepository } from '../types';
import { config } from '../../config';


function toDomain(doc: UserDocument | (UserDocument & { _id: any })): User {
  return {
    _id: String(doc._id),
    email: doc.email,
    firstName: doc.firstName,
    lastName: doc.lastName,
    status: doc.status,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    ordersCount: doc.ordersCount ?? 0,
  };
}

export class MongooseUserRepository implements UserRepository {

  async findById(id: string): Promise<User | null> {
    const query = UserModel.findById(id);
    const doc = config.experiment.useLean
      ? await query.lean<UserDocument>().exec()
      : await query.exec();

    if (!doc) return null;
    return toDomain(doc as UserDocument);
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = UserModel.findOne({ email: email.toLowerCase() });
    const doc = config.experiment.useLean
      ? await query.lean<UserDocument>().exec()
      : await query.exec();

    if (!doc) return null;
    return toDomain(doc as UserDocument);
  }

  async create(data: Omit<User, '_id' | 'ordersCount'>): Promise<User> {
    const doc = await UserModel.create({
      ...data,
      ordersCount: 0,
    });

    return toDomain(doc.toObject() as UserDocument);
  }

  async incrementOrdersCount(userId: string): Promise<void> {
    await UserModel.updateOne(
      { _id: userId },
      { $inc: { ordersCount: 1 } }
    ).exec();
  }
}