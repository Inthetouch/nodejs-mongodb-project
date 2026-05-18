import { Schema, model, Model } from 'mongoose';
import type { User, UserStatus } from './types';
import { USER_STATUSES } from './types';

export interface UserDocument extends Omit<User, '_id'> {
  _id: string;
}

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: USER_STATUSES as unknown as UserStatus[],
      default: 'active',
    },
    createdAt: { type: Date, default: () => new Date() },
    ordersCount: { type: Number, default: 0 },
  },
  {
    versionKey: false,
    collection: 'users',
  }
);

export const UserModel: Model<UserDocument> = model('User', userSchema);