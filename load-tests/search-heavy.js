import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { pickSearchTerm } from './lib/pool.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const searchLatency = new Trend('search_latency', true);
const errors = new Counter('custom_errors');

export const options = {
  scenarios: {
    search_heavy: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 30),
      duration: __ENV.DURATION || '40s',
    },
  },
  thresholds: {
    'search_latency': ['p(95)<1000'],
  },
};

export default function () {
  const term = pickSearchTerm();
  const res = http.get(`${BASE_URL}/products?search=${term}&pageSize=20`);
  searchLatency.add(res.timings.duration);

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
  });
  if (!ok) errors.add(1);
}

export function handleSummary(data) {
  const id = __ENV.RUN_ID || 'search-heavy';
  return {
    [`load-tests/results/${id}.summary.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const lines = [
    '',
    `  search_latency p50: ${(m.search_latency?.values?.med ?? 0).toFixed(2)}ms`,
    `  search_latency p95: ${(m.search_latency?.values?.['p(95)'] ?? 0).toFixed(2)}ms`,
    `  http_reqs:          ${(m.http_reqs?.values?.count ?? 0)} (${(m.http_reqs?.values?.rate ?? 0).toFixed(1)}/s)`,
    `  http_req_failed:    ${((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    '',
  ];
  return lines.join('\n');
}