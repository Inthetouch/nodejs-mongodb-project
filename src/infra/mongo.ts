import mongoose from 'mongoose';
import { config } from '../config';

export async function connectToMongo(): Promise<typeof mongoose> {
  await mongoose.connect(config.mongo.uri, {
    maxPoolSize: config.mongo.poolMax,
    minPoolSize: config.mongo.poolMin,
    serverSelectionTimeoutMS: 5000,
  });
  return mongoose;
}

export async function disconnectFromMongo(): Promise<void> {
  await mongoose.disconnect();
}