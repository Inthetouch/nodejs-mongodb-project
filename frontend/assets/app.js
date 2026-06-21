// Состояние приложения
const state = {
  meta: null,
  runs: [],
  filteredRuns: [],
  charts: {},
  stampede: null,
};

// Переход по якорю в URL при загрузке
function handleHashNavigation() {
  const hash = window.location.hash.replace('#', '');
  if (!hash) return;
  const link = document.querySelector(`.nav-link[data-section="${hash}"]`);
  if (link) link.click();
}

// Утилиты 
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const formatNum = (n, digits = 2) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const formatInt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('ru-RU');
};

const getThemeColors = () => {
  const styles = getComputedStyle(document.body);
  return {
    grid: styles.getPropertyValue('--chart-grid').trim(),
    text: styles.getPropertyValue('--chart-text').trim(),
    primary: styles.getPropertyValue('--accent-primary').trim(),
    success: styles.getPropertyValue('--accent-success').trim(),
    purple: styles.getPropertyValue('--accent-purple').trim(),
    warning: styles.getPropertyValue('--accent-warning').trim(),
    danger: styles.getPropertyValue('--accent-danger').trim(),
    secondary: styles.getPropertyValue('--text-secondary').trim(),
  };
};

// Тема
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);

  $('#themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);

    // Перерисовываем графики с новыми цветами
    Object.values(state.charts).forEach((ch) => ch && ch.destroy());
    state.charts = {};
    renderAllCharts();
  });
}

// Навигация 
function initNav() {
  $$('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.section;

      $$('.nav-link').forEach((l) => l.classList.toggle('active', l.dataset.section === target));
      $$('.section').forEach((s) => s.classList.toggle('active', s.id === target));

      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Графики рисуем только когда секция стала видимой
      if (target === 'charts' && Object.keys(state.charts).length === 0) {
        setTimeout(renderAllCharts, 100);
      }
    });
  });
}

// Загрузка данных
async function loadData() {
  try {
    const res = await fetch('data/runs.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Поддержка двух форматов: старого (простой массив) и нового ({meta, runs})
    if (Array.isArray(data)) {
      state.runs = data;
    } else {
      state.meta = data.meta || null;
      state.runs = data.runs || [];
      // Находим single-flight отдельно и выносим из общей выборки
      state.stampede = state.runs.find((r) => r.isStampede) || null;
      if (state.stampede) {
        state.runs = state.runs.filter((r) => !r.isStampede);
      }
    }
    state.filteredRuns = [...state.runs];

    populateFilters();
    renderTable();
    renderStampede();
    renderMeta();
  } catch (err) {
    console.error('Не удалось загрузить данные:', err);
    $('#runsTableBody').innerHTML = `
      <tr><td colspan="8" class="loading-row">
        Не удалось загрузить данные. Запусти агрегатор: python3 aggregate_runs.py
      </td></tr>`;
  }
}

// Фильтры
function populateFilters() {
  const scenarios = [...new Set(state.runs.map((r) => r.scenarioLabel))];
  const indexes = [...new Set(state.runs.map((r) => r.indexLabel))];

  const scenarioSelect = $('#filterScenario');
  scenarios.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    scenarioSelect.appendChild(opt);
  });

  const indexSelect = $('#filterIndex');
  indexes.forEach((i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    indexSelect.appendChild(opt);
  });

  ['filterScenario', 'filterIndex', 'filterCache'].forEach((id) => {
    $(`#${id}`).addEventListener('change', applyFilters);
  });
}

function applyFilters() {
  const s = $('#filterScenario').value;
  const i = $('#filterIndex').value;
  const c = $('#filterCache').value;

  state.filteredRuns = state.runs.filter((r) => {
    if (s && r.scenarioLabel !== s) return false;
    if (i && r.indexLabel !== i) return false;
    if (c === 'on' && !r.cacheEnabled) return false;
    if (c === 'off' && r.cacheEnabled) return false;
    return true;
  });

  renderTable();
}

// Таблица
function renderTable() {
  const body = $('#runsTableBody');
  if (state.filteredRuns.length === 0) {
    body.innerHTML = `<tr><td colspan="8" class="loading-row">Нет данных под фильтр</td></tr>`;
    return;
  }

  body.innerHTML = state.filteredRuns
    .map((r) => {
      const cacheBadge = r.cacheEnabled
        ? `<span class="badge badge-primary">${r.cacheImpl}</span>`
        : `<span class="badge badge-muted">выключен</span>`;

      const hitRateDisplay = r.cacheEnabled
        ? `${(r.cache.hitRate * 100).toFixed(1)}%`
        : '—';

      return `
        <tr>
          <td>${r.scenarioLabel}</td>
          <td>${r.indexLabel}</td>
          <td>${cacheBadge}</td>
          <td class="num">${formatNum(r.metrics.p50)}</td>
          <td class="num">${formatNum(r.metrics.p95)}</td>
          <td class="num">${formatInt(Math.round(r.metrics.rps))}</td>
          <td class="num">${hitRateDisplay}</td>
          <td class="num">${formatInt(r.metrics.iterations)}</td>
        </tr>
      `;
    })
    .join('');
}

// Графики
function chartCommonOptions(colors) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: colors.text, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: { color: colors.grid },
        ticks: { color: colors.text, font: { size: 11 } },
      },
      y: {
        grid: { color: colors.grid },
        ticks: { color: colors.text, font: { size: 11 } },
      },
    },
  };
}

function renderChartP50() {
  if (!window.Chart) {
    setTimeout(renderChartP50, 100);
    return;
  }

  const colors = getThemeColors();
  const ctx = $('#chartP50');
  if (!ctx) return;

  // Сокращённые названия для оси X — краткие коды прогонов
  const data = state.runs.map((r) => ({
    label: r.id.replace(/_/g, ' '),
    fullLabel: `${r.scenarioLabel} · ${r.indexLabel}${r.cacheEnabled ? ' · ' + r.cacheImpl : ''}`,
    value: r.metrics.p50,
    bg: r.cacheEnabled ? colors.success : colors.warning,
  })).sort((a, b) => b.value - a.value);

  state.charts.p50 = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map((d) => d.label),
      datasets: [{
        label: 'Время ответа p50, мс (лог. шкала)',
        data: data.map((d) => d.value),
        backgroundColor: data.map((d) => d.bg + 'cc'),
        borderColor: data.map((d) => d.bg),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      ...chartCommonOptions(colors),
      indexAxis: 'y', // Горизонтальные столбцы — читаемее для многих прогонов
      scales: {
        x: {
          type: 'logarithmic',
          grid: { color: colors.grid },
          ticks: { color: colors.text, font: { size: 11 } },
        },
        y: {
          grid: { color: colors.grid },
          ticks: { color: colors.text, font: { size: 10 } },
        },
      },
      plugins: {
        ...chartCommonOptions(colors).plugins,
        tooltip: {
          callbacks: {
            title: (items) => data[items[0].dataIndex].fullLabel,
            label: (item) => `p50 = ${item.parsed.x} мс`,
          },
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8,
        },
      },
    },
  });
}

function renderChartRps() {
  if (!window.Chart) return;
  const colors = getThemeColors();
  const ctx = $('#chartRps');
  if (!ctx) return;

  const data = state.runs.map((r) => ({
    label: r.id.replace(/_/g, ' '),
    fullLabel: `${r.scenarioLabel} · ${r.indexLabel}${r.cacheEnabled ? ' · ' + r.cacheImpl : ''}`,
    value: r.metrics.rps,
    bg: r.cacheEnabled ? colors.success : colors.warning,
  })).sort((a, b) => b.value - a.value);

  state.charts.rps = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map((d) => d.label),
      datasets: [{
        label: 'Запросов в секунду',
        data: data.map((d) => d.value),
        backgroundColor: data.map((d) => d.bg + 'cc'),
        borderColor: data.map((d) => d.bg),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      ...chartCommonOptions(colors),
      indexAxis: 'y',
      scales: {
        x: {
          grid: { color: colors.grid },
          ticks: { color: colors.text, font: { size: 11 } },
        },
        y: {
          grid: { color: colors.grid },
          ticks: { color: colors.text, font: { size: 10 } },
        },
      },
      plugins: {
        ...chartCommonOptions(colors).plugins,
        tooltip: {
          callbacks: {
            title: (items) => data[items[0].dataIndex].fullLabel,
            label: (item) => `${Math.round(item.parsed.x).toLocaleString('ru-RU')} запросов/сек`,
          },
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8,
        },
      },
    },
  });
}

function renderChartEsr() {
  if (!window.Chart) return;
  const colors = getThemeColors();
  const ctx = $('#chartEsr');
  if (!ctx) return;

  // Сравниваем индексные профили на одном сценарии — списки
  const listRuns = state.runs.filter((r) => r.scenario.includes('list'));
  if (listRuns.length === 0) {
    // Fallback: если нет list-runs, используем общую картину
    const fallback = state.runs.filter((r) => !r.cacheEnabled);
    if (fallback.length > 0) {
      drawComparisonChart(ctx, fallback, 'p50', colors, 'Время ответа p50, мс');
      return;
    }
    return;
  }

  drawComparisonChart(ctx, listRuns, 'p50', colors, 'Время ответа p50, мс');
}

function renderChartRedis() {
  if (!window.Chart) return;
  const colors = getThemeColors();
  const ctx = $('#chartRedis');
  if (!ctx) return;

  // Сравниваем варианты с кэшем и без на одном сценарии (read-heavy = чтение по ID)
  const readRuns = state.runs.filter((r) => r.scenario.includes('read-heavy') && !r.scenario.includes('list'));
  if (readRuns.length === 0) {
    drawComparisonChart(ctx, state.runs, 'p50', colors, 'Время ответа p50, мс');
    return;
  }

  drawComparisonChart(ctx, readRuns, 'p50', colors, 'Время ответа p50, мс');
}

function drawComparisonChart(ctx, runs, metric, colors, label) {
  const data = runs.map((r) => ({
    label: `${r.indexLabel}${r.cacheEnabled ? ' + Redis' : ''}`,
    value: r.metrics[metric],
  }));

  const chartKey = ctx.id;
  state.charts[chartKey] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map((d) => d.label),
      datasets: [{
        label,
        data: data.map((d) => d.value),
        backgroundColor: [colors.danger, colors.warning, colors.success, colors.primary].map((c) => c + 'cc'),
        borderColor: [colors.danger, colors.warning, colors.success, colors.primary],
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: chartCommonOptions(colors),
  });
}

function renderAllCharts() {
  if (state.runs.length === 0) return;
  renderChartP50();
  renderChartRps();
  renderChartEsr();
  renderChartRedis();
}

// Обновление блока single-flight из реальных данных
function renderStampede() {
  if (!state.stampede) return;
  const sm = state.stampede.stampedeMetrics;
  if (!sm) return;

  const set = (sel, val) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  };

  set('[data-stampede="total"]', sm.totalRequests);
  set('[data-stampede="misses"]', sm.missesDuringStampede);
  set('[data-stampede="mongo"]', sm.mongoQueriesDeduplicated);
  set('[data-stampede="ratio"]', sm.deduplicationRatio + '×');
  set('[data-stampede="efficiency"]', sm.efficiencyPercent + '%');
}

// Обновление метаданных среды
function renderMeta() {
  if (!state.meta) return;
  const env = state.meta.environment || {};
  const set = (sel, val) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  };
  set('[data-meta="cpu"]', env.cpu);
  set('[data-meta="ram"]', env.ram);
  set('[data-meta="os"]', env.os);
  set('[data-meta="docker"]', env.docker);
  set('[data-meta="node"]', env.node);
  set('[data-meta="mongo"]', env.mongo);
  set('[data-meta="totalRuns"]', state.meta.totalRuns);
}

// KPI обновление из данных
function updateKpis() {
  if (state.runs.length === 0) return;
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  loadData().then(() => {
    handleHashNavigation();
    if ($('.section.active')?.id === 'charts') {
      setTimeout(renderAllCharts, 100);
    }
  });
  window.addEventListener('hashchange', handleHashNavigation);
});
