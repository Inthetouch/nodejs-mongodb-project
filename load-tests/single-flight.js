import http from 'k6/http';
import { check, sleep } from 'k6';
import { poolData } from './lib/pool.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const HOT_ID = poolData.hotProducts[0];

const TTL_SECONDS = Number(__ENV.TTL || 5);

export const options = {
  scenarios: {
    stampede: {
      executor: 'per-vu-iterations',
      vus: Number(__ENV.VUS || 100),
      iterations: 6,
      maxDuration: '90s',
    },
  },
};

export default function () {
  sleep(TTL_SECONDS + 0.1);

  const res = http.get(`${BASE_URL}/products/${HOT_ID}`);
  check(res, { 'status 200': (r) => r.status === 200 });
}

export function handleSummary(data) {
  const id = __ENV.RUN_ID || 'single-flight';
  return {
    [`load-tests/results/${id}.summary.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const lines = [
    '',
    `  http_req_duration p50: ${(m.http_req_duration?.values?.med ?? 0).toFixed(2)}ms`,
    `  http_req_duration p95: ${(m.http_req_duration?.values?.['p(95)'] ?? 0).toFixed(2)}ms`,
    `  http_reqs:             ${(m.http_reqs?.values?.count ?? 0)}`,
    `  http_req_failed:       ${((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    '',
    '  → ОТКРОЙ /admin/stats ДО и ПОСЛЕ прогона.',
    '  → Сравни cache_misses_total с mongo_queries_total{op="findOne"}.',
    '  → Эффективность single-flight = 1 - (mongo / misses).',
    '',
  ];
  return lines.join('\n');
}