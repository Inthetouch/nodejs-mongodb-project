import mongoose, { type Schema } from 'mongoose';
import type { MetricsRegistry } from './registry';

const QUERY_OPS = [
  'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
  'countDocuments', 'estimatedDocumentCount',
  'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
] as const;

export function installMongooseMetricsPlugin(metrics: MetricsRegistry): void {
  const plugin = (schema: Schema): void => {
    const collectionName = (schema as any).options?.collection ?? 'unknown';

    for (const op of QUERY_OPS) {
      schema.pre(op as any, function (this: any) {
        this.__metricsStart = process.hrtime.bigint();
      });
      schema.post(op as any, function (this: any) {
        if (!this.__metricsStart) return;
        const durationMs = Number(process.hrtime.bigint() - this.__metricsStart) / 1e6;
        metrics.mongoQueriesTotal.inc({ collection: collectionName, op });
        metrics.mongoQueryDurationMs.observe({ collection: collectionName, op }, durationMs);
      });
    }

    schema.pre('save', function (this: any) {
      this.__metricsStart = process.hrtime.bigint();
    });
    schema.post('save', function (this: any) {
      if (!this.__metricsStart) return;
      const durationMs = Number(process.hrtime.bigint() - this.__metricsStart) / 1e6;
      metrics.mongoQueriesTotal.inc({ collection: collectionName, op: 'save' });
      metrics.mongoQueryDurationMs.observe({ collection: collectionName, op: 'save' }, durationMs);
    });

    schema.pre('aggregate', function (this: any) {
      this.__metricsStart = process.hrtime.bigint();
    });
    schema.post('aggregate', function (this: any) {
      if (!this.__metricsStart) return;
      const durationMs = Number(process.hrtime.bigint() - this.__metricsStart) / 1e6;
      metrics.mongoQueriesTotal.inc({ collection: collectionName, op: 'aggregate' });
      metrics.mongoQueryDurationMs.observe({ collection: collectionName, op: 'aggregate' }, durationMs);
    });
  };

  mongoose.plugin(plugin);
}