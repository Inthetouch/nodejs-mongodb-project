import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

export const adminCleanupRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.delete('/orders/load-test', async () => {
    const startedAt = Date.now();
    const db = mongoose.connection.db!;
    const orders = db.collection('orders');
    const users = db.collection('users');

    const grouped = await orders.aggregate<{ _id: string; count: number }>([
      { $match: { loadTestRun: true } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]).toArray();

    if (grouped.length > 0) {
      const bulkOps = grouped.map(g => ({
        updateOne: {
          filter: { _id: new ObjectId(g._id) },
          update: { $inc: { ordersCount: -g.count } },
        },
      }));
      await users.bulkWrite(bulkOps, { ordered: false });
    }

    // 3. Удаляем сами заказы.
    const deleteResult = await orders.deleteMany({ loadTestRun: true });

    return {
      deletedCount: deleteResult.deletedCount,
      affectedUsers: grouped.length,
      durationMs: Date.now() - startedAt,
    };
  });
};