import { MetricsRegistry } from './registry';
import { installMongooseMetricsPlugin } from './mongo';
import { config } from '../config';

export const metricsSingleton = new MetricsRegistry();

if (config.metrics.enabled) {
  installMongooseMetricsPlugin(metricsSingleton);
}