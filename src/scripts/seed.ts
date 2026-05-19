import 'dotenv/config';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { connectToMongo, disconnectFromMongo } from '../infra/mongo';
import {
  UserModel,
  ProductModel,
  OrderModel,
  PRODUCT_CATEGORIES,
  USER_STATUSES,
  ORDER_STATUSES,
} from '../models';
import type { ProductCategory, UserStatus, OrderStatus } from '../models/types';

const CONFIG = {
  productsCount: 200_000,
  usersCount: 50_000,
  ordersCount: 100_000,
  batchSize: 10_000,
};

faker.seed(42);

function weighted<T>(weights: Array<[T, number]>): T {
  const totalWeight = weights.reduce((sum, [, w]) => sum + w, 0);
  let r = faker.number.float({ min: 0, max: totalWeight });
  for (const [value, weight] of weights) {
    r -= weight;
    if (r <= 0) return value;
  }
  return weights[weights.length - 1][0];
}

const CATEGORY_WEIGHTS: Array<[ProductCategory, number]> = [
  ['electronics', 30],
  ['clothing', 30],
  ['books', 12],
  ['home', 12],
  ['sports', 6],
  ['beauty', 3],
  ['food', 3],
  ['toys', 2],
  ['auto', 1],
  ['other', 1],
];

const USER_STATUS_WEIGHTS: Array<[UserStatus, number]> = [
  ['active', 70],
  ['inactive', 25],
  ['banned', 5],
];

const ORDER_STATUS_WEIGHTS: Array<[OrderStatus, number]> = [
  ['delivered', 60],
  ['shipped', 15],
  ['paid', 10],
  ['pending', 8],
  ['cancelled', 7],
];

async function seedUsers(): Promise<string[]> {
  console.log(`[seed] users: starting (${CONFIG.usersCount} docs)`);
  const startedAt = Date.now();

  await UserModel.collection.drop().catch(() => {/* коллекции могло не быть */});

  const userIds: string[] = [];
  let batch: any[] = [];

  for (let i = 0; i < CONFIG.usersCount; i++) {
    const id = new mongoose.Types.ObjectId();
    userIds.push(id.toHexString());

    batch.push({
      _id: id,
      email: `user${i}@example.com`,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      status: weighted(USER_STATUS_WEIGHTS),
      createdAt: faker.date.past({ years: 2 }),
      ordersCount: 0,
    });

    if (batch.length >= CONFIG.batchSize) {
      await UserModel.insertMany(batch, { ordered: false });
      batch = [];
      process.stdout.write(`  ...${i + 1}/${CONFIG.usersCount}\r`);
    }
  }
  if (batch.length > 0) await UserModel.insertMany(batch, { ordered: false });

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n[seed] users: done in ${elapsed}s`);
  return userIds;
}

async function seedProducts(): Promise<Array<{ id: string; title: string; price: number }>> {
  console.log(`[seed] products: starting (${CONFIG.productsCount} docs)`);
  const startedAt = Date.now();

  await ProductModel.collection.drop().catch(() => {});

  const productRefs: Array<{ id: string; title: string; price: number }> = [];
  let batch: any[] = [];

  for (let i = 0; i < CONFIG.productsCount; i++) {
    const id = new mongoose.Types.ObjectId();
    const category = weighted(CATEGORY_WEIGHTS);
    const title = faker.commerce.productName();
    const price = Math.round(Math.exp(faker.number.float({ min: 2, max: 8 })) * 100) / 100;
    const sku = `SKU-${category.slice(0, 3).toUpperCase()}-${String(i).padStart(7, '0')}`;

    productRefs.push({ id: id.toHexString(), title, price });

    batch.push({
      _id: id,
      sku,
      title,
      description: faker.commerce.productDescription(),
      category,
      price,
      rating: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
      stock: faker.number.int({ min: 0, max: 1000 }),
      tags: faker.helpers.arrayElements(
        ['new', 'sale', 'popular', 'premium', 'eco', 'limited', 'gift'],
        faker.number.int({ min: 0, max: 4 }),
      ),
      createdAt: faker.date.past({ years: 1 }),
    });

    if (batch.length >= CONFIG.batchSize) {
      await ProductModel.insertMany(batch, { ordered: false });
      batch = [];
      process.stdout.write(`  ...${i + 1}/${CONFIG.productsCount}\r`);
    }
  }
  if (batch.length > 0) await ProductModel.insertMany(batch, { ordered: false });

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n[seed] products: done in ${elapsed}s`);
  return productRefs;
}

async function seedOrders(
  userIds: string[],
  productRefs: Array<{ id: string; title: string; price: number }>,
): Promise<void> {
  console.log(`[seed] orders: starting (${CONFIG.ordersCount} docs)`);
  const startedAt = Date.now();

  await OrderModel.collection.drop().catch(() => {});

  const userOrderCounts = new Map<string, number>();

  let batch: any[] = [];

  for (let i = 0; i < CONFIG.ordersCount; i++) {
    const idx = Math.floor(Math.pow(Math.random(), 2) * userIds.length);
    const userId = userIds[idx];
    userOrderCounts.set(userId, (userOrderCounts.get(userId) ?? 0) + 1);

    const itemCount = faker.number.int({ min: 1, max: 5 });
    const items = [];
    let totalAmount = 0;

    for (let j = 0; j < itemCount; j++) {
      const product = faker.helpers.arrayElement(productRefs);
      const quantity = faker.number.int({ min: 1, max: 3 });
      const itemTotal = product.price * quantity;
      totalAmount += itemTotal;

      items.push({
        productId: product.id,
        productTitle: product.title,
        quantity,
        pricePerUnit: product.price,
      });
    }

    batch.push({
      _id: new mongoose.Types.ObjectId(),
      userId,
      status: weighted(ORDER_STATUS_WEIGHTS),
      items,
      totalAmount: Math.round(totalAmount * 100) / 100,
      createdAt: faker.date.past({ years: 1 }),
    });

    if (batch.length >= CONFIG.batchSize) {
      await OrderModel.insertMany(batch, { ordered: false });
      batch = [];
      process.stdout.write(`  ...${i + 1}/${CONFIG.ordersCount}\r`);
    }
  }
  if (batch.length > 0) await OrderModel.insertMany(batch, { ordered: false });

  console.log('\n[seed] updating user.ordersCount...');
  const bulkOps = Array.from(userOrderCounts.entries()).map(([userId, count]) => ({
    updateOne: {
      filter: { _id: new mongoose.Types.ObjectId(userId) },
      update: { $set: { ordersCount: count } },
    },
  }));
  if (bulkOps.length > 0) {
    await UserModel.bulkWrite(bulkOps);
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[seed] orders: done in ${elapsed}s`);
}

async function main() {
  await connectToMongo();

  const totalStart = Date.now();
  const userIds = await seedUsers();
  const productRefs = await seedProducts();
  await seedOrders(userIds, productRefs);
  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);

  console.log(`\n[seed] total time: ${totalElapsed}s`);

  const stats = {
    users: await UserModel.countDocuments(),
    products: await ProductModel.countDocuments(),
    orders: await OrderModel.countDocuments(),
  };
  console.log('[seed] final counts:', stats);

  await disconnectFromMongo();
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});