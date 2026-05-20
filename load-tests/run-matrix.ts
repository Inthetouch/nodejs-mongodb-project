import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const RESULTS_DIR = path.resolve(process.cwd(), 'load-tests', 'results');
const VUS_DEFAULT = process.env.VUS || '50';
const DURATION_DEFAULT = process.env.DURATION || '40s';

interface RunSpec {
  id: string;
  scenario: string;
  indexProfile: 'none' | 'single' | 'esr' | 'text';
  cacheImpl: 'none' | 'lru' | 'redis';
  cacheEnabled: boolean;
  vus?: string;
  warmupDuration?: string;
  isWrite?: boolean;
}

function warmupDuration(spec: RunSpec): string {
  if (spec.warmupDuration) return spec.warmupDuration;
  if (spec.scenario === 'read-heavy.js' && !spec.cacheEnabled && spec.indexProfile === 'none') {
    return '30s';
  }
  if (spec.scenario === 'read-list-heavy.js' && !spec.cacheEnabled && spec.indexProfile === 'none') {
    return '60s';
  }
  if (spec.scenario === 'mixed.js') return '20s';
  if (spec.scenario === 'write-heavy.js') return '15s';
  if (spec.scenario === 'search-heavy.js') return '15s';
  return '12s';
}

const MATRIX: RunSpec[] = [
  // ========== ГРУППА OFF (CACHE_ENABLED=false) — 7 прогонов ==========
  { id: 'read_none_off',    scenario: 'read-heavy.js',   indexProfile: 'none',   cacheImpl: 'none', cacheEnabled: false },
  { id: 'read_single_off',  scenario: 'read-heavy.js',   indexProfile: 'single', cacheImpl: 'none', cacheEnabled: false },
  { id: 'read_esr_off',     scenario: 'read-heavy.js',   indexProfile: 'esr',    cacheImpl: 'none', cacheEnabled: false },
  { id: 'read_list_none_off',   scenario: 'read-list-heavy.js', indexProfile: 'none',   cacheImpl: 'none', cacheEnabled: false },
  { id: 'read_list_single_off', scenario: 'read-list-heavy.js', indexProfile: 'single', cacheImpl: 'none', cacheEnabled: false },
  { id: 'read_list_esr_off',    scenario: 'read-list-heavy.js', indexProfile: 'esr',    cacheImpl: 'none', cacheEnabled: false },
  // Search без кэша.
  { id: 'search_text_off',  scenario: 'search-heavy.js', indexProfile: 'text',   cacheImpl: 'none', cacheEnabled: false, vus: '30' },
  // Mixed без кэша.
  { id: 'mixed_none_off',   scenario: 'mixed.js',        indexProfile: 'none',   cacheImpl: 'none', cacheEnabled: false },
  { id: 'mixed_single_off', scenario: 'mixed.js',        indexProfile: 'single', cacheImpl: 'none', cacheEnabled: false },
  { id: 'mixed_esr_off',    scenario: 'mixed.js',        indexProfile: 'esr',    cacheImpl: 'none', cacheEnabled: false },

  // ========== ГРУППА REDIS (CACHE_ENABLED=true, CACHE_IMPL=redis) — 9 прогонов ==========
  { id: 'read_esr_redis',   scenario: 'read-heavy.js',   indexProfile: 'esr',    cacheImpl: 'redis', cacheEnabled: true },
  { id: 'read_none_redis',  scenario: 'read-heavy.js',   indexProfile: 'none',   cacheImpl: 'redis', cacheEnabled: true },
  { id: 'read_list_esr_redis',  scenario: 'read-list-heavy.js', indexProfile: 'esr',    cacheImpl: 'redis', cacheEnabled: true },
  { id: 'search_text_redis',scenario: 'search-heavy.js', indexProfile: 'text',   cacheImpl: 'redis', cacheEnabled: true, vus: '30' },
  { id: 'mixed_none_redis', scenario: 'mixed.js',        indexProfile: 'none',   cacheImpl: 'redis', cacheEnabled: true },
  { id: 'mixed_single_redis',scenario:'mixed.js',        indexProfile: 'single', cacheImpl: 'redis', cacheEnabled: true },
  { id: 'mixed_esr_redis',  scenario: 'mixed.js',        indexProfile: 'esr',    cacheImpl: 'redis', cacheEnabled: true },
  { id: 'write_none_redis', scenario: 'write-heavy.js',  indexProfile: 'none',   cacheImpl: 'redis', cacheEnabled: true, vus: '30', isWrite: true },
  { id: 'write_single_redis',scenario:'write-heavy.js',  indexProfile: 'single', cacheImpl: 'redis', cacheEnabled: true, vus: '30', isWrite: true },
  { id: 'write_esr_redis',  scenario: 'write-heavy.js',  indexProfile: 'esr',    cacheImpl: 'redis', cacheEnabled: true, vus: '30', isWrite: true },

  // ========== ГРУППА LRU (CACHE_ENABLED=true, CACHE_IMPL=lru) — 1 прогон ==========
  { id: 'read_esr_lru',     scenario: 'read-heavy.js',   indexProfile: 'esr',    cacheImpl: 'lru',   cacheEnabled: true },
];

async function adminPost(pathname: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': ADMIN_TOKEN,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 207) {
    throw new Error(`Admin POST ${pathname} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function adminGet(pathname: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    headers: { 'X-Admin-Token': ADMIN_TOKEN },
  });
  if (!res.ok) throw new Error(`Admin GET ${pathname} failed: ${res.status}`);
  return res.json();
}

async function adminDelete(pathname: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': ADMIN_TOKEN },
  });
  if (!res.ok) throw new Error(`Admin DELETE ${pathname} failed: ${res.status}`);
  return res.json();
}

async function setIndexProfile(profile: string): Promise<void> {
  console.log(`  [matrix] индексы -> ${profile}`);
  const result = await adminPost('/admin/indexes', { profile });
  console.log(`  [matrix]   создано ${result.created?.length ?? 0}, удалено ${result.dropped?.length ?? 0}, ${result.durationMs} мс`);
}

async function flushCache(): Promise<void> {
  const result = await adminPost('/admin/cache/flush', {});
  console.log(`  [matrix] кэш: ${result.action}`);
}

async function cleanupLoadTestOrders(): Promise<void> {
  const result = await adminDelete('/admin/orders/load-test');
  console.log(`  [matrix] cleanup: удалено заказов=${result.deletedCount}, пользователей=${result.affectedUsers}, ${result.durationMs} мс`);
}

function runK6(spec: RunSpec, duration: string, captureOutput: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const scenarioPath = path.resolve(process.cwd(), 'load-tests', spec.scenario);
    const env = {
      ...process.env,
      BASE_URL,
      VUS: spec.vus || VUS_DEFAULT,
      DURATION: duration,
      RUN_ID: spec.id,
    };
    const proc = spawn('k6', ['run', scenarioPath], {
      env,
      stdio: captureOutput ? 'inherit' : 'ignore',
    });
    proc.on('close', () => resolve());
    proc.on('error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  if (!ADMIN_TOKEN) {
    console.error('[matrix] ОШИБКА: ADMIN_TOKEN не задан в .env');
    process.exit(1);
  }
  await fs.mkdir(RESULTS_DIR, { recursive: true });

  const stats = await adminGet('/admin/stats');
  const currentCacheImpl = stats.cache.impl;
  const currentCacheEnabled = stats.cache.enabled;
  console.log(`[matrix] сервер: cache.impl=${currentCacheImpl}, cache.enabled=${currentCacheEnabled}`);

  const filtered = MATRIX.filter(spec =>
    spec.cacheImpl === currentCacheImpl && spec.cacheEnabled === currentCacheEnabled
  );
  console.log(`[matrix] прогонов для текущей конфигурации: ${filtered.length} из ${MATRIX.length}`);

  if (filtered.length === 0) {
    console.log(`[matrix] нет прогонов под эту конфигурацию. Перезапусти сервер с нужным CACHE_IMPL/CACHE_ENABLED.`);
    process.exit(0);
  }

  const startedAt = Date.now();

  for (const spec of filtered) {
    console.log(`\n[matrix] === ${spec.id} ===`);

    await setIndexProfile(spec.indexProfile);
    await sleep(2000);

    if (spec.isWrite) {
      await cleanupLoadTestOrders();
      await sleep(500);
    }

    await flushCache();
    await sleep(500);

    const before = await adminGet('/admin/stats');

    const warmupDur = warmupDuration(spec);
    console.log(`  [matrix] прогрев (${warmupDur})...`);
    await runK6(spec, warmupDur, false);
    await sleep(500);

    const afterWarmup = await adminGet('/admin/stats');

    console.log(`  [matrix] боевой прогон (${DURATION_DEFAULT}, VUS=${spec.vus || VUS_DEFAULT})...`);
    await runK6(spec, DURATION_DEFAULT, true);

    const after = await adminGet('/admin/stats');

    const snapshotsPath = path.join(RESULTS_DIR, `${spec.id}.stats.json`);
    await fs.writeFile(snapshotsPath, JSON.stringify({
      spec,
      before,
      afterWarmup,
      after,
      delta: {
        cache_hits: (after.cache?.hits?.total ?? 0) - (afterWarmup.cache?.hits?.total ?? 0),
        cache_misses: (after.cache?.misses?.total ?? 0) - (afterWarmup.cache?.misses?.total ?? 0),
        mongo_queries: (after.mongo?.queries?.total ?? 0) - (afterWarmup.mongo?.queries?.total ?? 0),
        hitRateDuringRun: (() => {
          const h = (after.cache?.hits?.total ?? 0) - (afterWarmup.cache?.hits?.total ?? 0);
          const m = (after.cache?.misses?.total ?? 0) - (afterWarmup.cache?.misses?.total ?? 0);
          return (h + m) > 0 ? h / (h + m) : null;
        })(),
      },
    }, null, 2));

    await sleep(2000);
  }

  const elapsed = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);
  console.log(`\n[matrix] завершено. Время: ${elapsed} мин. Результаты в ${RESULTS_DIR}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[matrix] критическая ошибка:', err);
  process.exit(1);
});