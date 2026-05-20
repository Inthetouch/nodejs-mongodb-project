import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { pickProduct, pickUser } from './lib/pool.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const readLatency = new Trend('mixed_read_latency', true);
const writeLatency = new Trend('mixed_write_latency', true);
const errors = new Counter('custom_errors');

export const options = {
  scenarios: {
    mixed: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 50),
      duration: __ENV.DURATION || '40s',
    },
  },
};

export default function () {
  const roll = Math.random();

  if (roll < 0.95) {
    const productId = pickProduct();
    const res = http.get(`${BASE_URL}/products/${productId}`);
    readLatency.add(res.timings.duration);
    const ok = check(res, { 'read 200': (r) => r.status === 200 });
    if (!ok) errors.add(1);
  } else {
    const payload = JSON.stringify({
      userId: pickUser(),
      items: [{
        productId: pickProduct(),
        productTitle: 'Mixed Test Product',
        quantity: 1,
        pricePerUnit: 19.99,
      }],
      loadTestRun: true,
    });
    const res = http.post(`${BASE_URL}/orders`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    writeLatency.add(res.timings.duration);
    const ok = check(res, { 'write 201': (r) => r.status === 201 });
    if (!ok) errors.add(1);
  }
}

export function handleSummary(data) {
  const id = __ENV.RUN_ID || 'mixed';
  return {
    [`load-tests/results/${id}.summary.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const lines = [
    '',
    `  mixed_read_latency  p50: ${(m.mixed_read_latency?.values?.med ?? 0).toFixed(2)}ms`,
    `  mixed_read_latency  p95: ${(m.mixed_read_latency?.values?.['p(95)'] ?? 0).toFixed(2)}ms`,
    `  mixed_write_latency p50: ${(m.mixed_write_latency?.values?.med ?? 0).toFixed(2)}ms`,
    `  mixed_write_latency p95: ${(m.mixed_write_latency?.values?.['p(95)'] ?? 0).toFixed(2)}ms`,
    `  http_reqs:               ${(m.http_reqs?.values?.count ?? 0)} (${(m.http_reqs?.values?.rate ?? 0).toFixed(1)}/s)`,
    `  http_req_failed:         ${((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    '',
  ];
  return lines.join('\n');
}