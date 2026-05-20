import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { pickProduct, pickUser } from './lib/pool.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const orderLatency = new Trend('order_create_latency', true);
const errors = new Counter('custom_errors');

export const options = {
  scenarios: {
    write_heavy: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 30),
      duration: __ENV.DURATION || '40s',
    },
  },
  thresholds: {
    'order_create_latency': ['p(95)<1000'],
  },
};

export default function () {
  const userId = pickUser();
  const productId = pickProduct();
  const payload = JSON.stringify({
    userId: userId,
    items: [
      {
        productId: productId,
        productTitle: 'Load Test Product',
        quantity: 1,
        pricePerUnit: 9.99,
      },
    ],
    loadTestRun: true,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(`${BASE_URL}/orders`, payload, params);
  orderLatency.add(res.timings.duration);

  const ok = check(res, {
    'status 201': (r) => r.status === 201,
  });
  if (!ok) errors.add(1);
}

export function handleSummary(data) {
  const id = __ENV.RUN_ID || 'write-heavy';
  return {
    [`load-tests/results/${id}.summary.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const lines = [
    '',
    `  order_create_latency p50: ${(m.order_create_latency?.values?.med ?? 0).toFixed(2)}ms`,
    `  order_create_latency p95: ${(m.order_create_latency?.values?.['p(95)'] ?? 0).toFixed(2)}ms`,
    `  order_create_latency p99: ${(m.order_create_latency?.values?.['p(99)'] ?? 0).toFixed(2)}ms`,
    `  http_reqs:                ${(m.http_reqs?.values?.count ?? 0)} (${(m.http_reqs?.values?.rate ?? 0).toFixed(1)}/s)`,
    `  http_req_failed:          ${((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    '',
  ];
  return lines.join('\n');
}