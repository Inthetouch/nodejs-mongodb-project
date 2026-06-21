// ============================================================================
// Chart.js-графики в академическом стиле matplotlib для дашборда ВКР.
// Каждая функция рисует один график из 10 (рис. 3.0 - 3.9).
// Стиль: бирюзовый/серый/малиновый, подписи значений над столбцами, светлая
// сетка, центрированный заголовок отключён (заголовок в HTML над канвасом).
// ============================================================================

// --- Палитра в духе matplotlib из ВКР ---
const PALETTE = {
  teal: '#0E7C7B',        // основной бирюзовый
  tealAlpha: 'rgba(14, 124, 123, 0.85)',
  gray: '#8E8E8E',        // p95 / без кэша
  grayAlpha: 'rgba(142, 142, 142, 0.85)',
  beige: '#D5CFC0',       // p99
  beigeAlpha: 'rgba(213, 207, 192, 0.85)',
  magenta: '#A23B72',     // OFF / промахи
  magentaAlpha: 'rgba(162, 59, 114, 0.85)',
  text: '#1f2937',
  grid: 'rgba(0, 0, 0, 0.08)',
};

// --- Плагин для подписи значений над столбцами ---
// Рисует число (мс/количество) прямо над каждым столбцом. Это ключевая фича
// академических графиков, делающая их читаемыми без наведения курсора.
const valueLabelsPlugin = {
  id: 'valueLabels',
  afterDatasetsDraw(chart, args, opts) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = opts.color || PALETTE.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    chart.data.datasets.forEach((dataset, dsIdx) => {
      const meta = chart.getDatasetMeta(dsIdx);
      meta.data.forEach((bar, idx) => {
        const value = dataset.data[idx];
        if (value === null || value === undefined) return;
        const formatted = opts.formatter ? opts.formatter(value) : String(value);
        // Положение над верхушкой столбца с отступом 4 px
        ctx.fillText(formatted, bar.x, bar.y - 4);
      });
    });
    ctx.restore();
  },
};

// --- Базовые настройки, общие для всех графиков ---
function baseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 24, right: 12, bottom: 8, left: 8 },
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: PALETTE.text,
          font: { size: 12, weight: '500' },
          boxWidth: 14,
          boxHeight: 14,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.92)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 10,
        cornerRadius: 6,
        displayColors: true,
        boxPadding: 4,
      },
      title: { display: false },
      ...(extra.plugins || {}),
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: 'rgba(0, 0, 0, 0.2)' },
        ticks: {
          color: PALETTE.text,
          font: { size: 12, weight: '500' },
        },
      },
      y: {
        grid: { color: PALETTE.grid, drawTicks: false },
        border: { display: false },
        ticks: {
          color: PALETTE.text,
          font: { size: 11 },
          padding: 8,
        },
        beginAtZero: true,
        ...(extra.yScale || {}),
      },
    },
    animation: { duration: 600, easing: 'easeOutQuart' },
  };
}

// --- Хелпер: настройки датасета в академическом стиле ---
function bar(label, data, color, alpha) {
  return {
    label,
    data,
    backgroundColor: alpha,
    borderColor: color,
    borderWidth: 1.5,
    borderRadius: 2,
    barPercentage: 0.75,
    categoryPercentage: 0.8,
  };
}

// ============================================================================
// Рис. 3.0. Сравнение explain-планов
// Два графика рядом в одном канвасе невозможно через Chart.js напрямую,
// поэтому показываем totalDocsExamined (с логарифмической шкалой)
// + бейдж с executionTimeMillis в подписях.
// ============================================================================
function drawFig0() {
  const ctx = document.getElementById('chart_fig0');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'Простые индексы', 'ESR-индексы'],
      datasets: [
        bar('Просмотрено документов', [200000, 24085, 10], PALETTE.teal, PALETTE.tealAlpha),
      ],
    },
    options: {
      ...baseOptions({
        yScale: { type: 'logarithmic' },
      }),
      plugins: {
        ...baseOptions().plugins,
        valueLabels: {
          formatter: (v) => v.toLocaleString('ru-RU'),
        },
      },
    },
    plugins: [valueLabelsPlugin],
  });
}

// ============================================================================
// Рис. 3.1. Эффект индексов на list-запросы (p50/p95/p99)
// ============================================================================
function drawFig1() {
  const ctx = document.getElementById('chart_fig1');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'Простые индексы', 'ESR-индексы'],
      datasets: [
        bar('p50', [607, 143, 66], PALETTE.teal, PALETTE.tealAlpha),
        bar('p95', [749, 453, 223], PALETTE.gray, PALETTE.grayAlpha),
        bar('p99', [823, 567, 293], PALETTE.beige, PALETTE.beigeAlpha),
      ],
    },
    options: {
      ...baseOptions(),
      plugins: {
        ...baseOptions().plugins,
        valueLabels: { formatter: (v) => `${v}` },
      },
    },
    plugins: [valueLabelsPlugin],
  });
}

// ============================================================================
// Рис. 3.2. Чтение по ID: профиль индексов не влияет
// ============================================================================
function drawFig2() {
  const ctx = document.getElementById('chart_fig2');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'Простые индексы', 'ESR-индексы'],
      datasets: [
        bar('p50', [9.7, 9.5, 9.7], PALETTE.teal, PALETTE.tealAlpha),
        bar('p95', [14.9, 14.4, 14.7], PALETTE.gray, PALETTE.grayAlpha),
      ],
    },
    options: {
      ...baseOptions(),
      plugins: {
        ...baseOptions().plugins,
        valueLabels: { formatter: (v) => v.toFixed(1) },
      },
    },
    plugins: [valueLabelsPlugin],
  });
}

// ============================================================================
// Рис. 3.3. Mixed-нагрузка без кэша: read и write по профилям
// ============================================================================
function drawFig3() {
  const ctx = document.getElementById('chart_fig3');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'Простые индексы', 'ESR-индексы'],
      datasets: [
        bar('Read p50', [11.5, 11.0, 11.2], PALETTE.teal, PALETTE.tealAlpha),
        bar('Write p50', [26.0, 25.6, 25.6], PALETTE.magenta, PALETTE.magentaAlpha),
      ],
    },
    options: {
      ...baseOptions(),
      plugins: {
        ...baseOptions().plugins,
        valueLabels: { formatter: (v) => v.toFixed(1) },
      },
    },
    plugins: [valueLabelsPlugin],
  });
}

// ============================================================================
// Рис. 3.4. Эффект Redis-кэша на read-by-id — пары OFF/REDIS
// ============================================================================
function drawFig4() {
  const ctx = document.getElementById('chart_fig4');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'ESR-индексы'],
      datasets: [
        bar('Без кэша (OFF)', [9.7, 9.7], PALETTE.magenta, PALETTE.magentaAlpha),
        bar('С Redis', [2.3, 2.3], PALETTE.teal, PALETTE.tealAlpha),
      ],
    },
    options: {
      ...baseOptions(),
      plugins: {
        ...baseOptions().plugins,
        valueLabels: { formatter: (v) => v.toFixed(1) },
      },
    },
    plugins: [valueLabelsPlugin],
  });
}

// ============================================================================
// Рис. 3.5. Mixed-нагрузка с Redis (read и write)
// ============================================================================
function drawFig5() {
  const ctx = document.getElementById('chart_fig5');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'Простые индексы', 'ESR-индексы'],
      datasets: [
        bar('Read p50', [4.5, 4.5, 4.5], PALETTE.teal, PALETTE.tealAlpha),
        bar('Write p50', [17.5, 17.0, 17.0], PALETTE.magenta, PALETTE.magentaAlpha),
      ],
    },
    options: {
      ...baseOptions(),
      plugins: {
        ...baseOptions().plugins,
        valueLabels: { formatter: (v) => v.toFixed(1) },
      },
    },
    plugins: [valueLabelsPlugin],
  });
}

// ============================================================================
// Рис. 3.6. Стоимость индексов при записи (POST /orders)
// ============================================================================
function drawFig6() {
  const ctx = document.getElementById('chart_fig6');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'Простые индексы', 'ESR-индексы'],
      datasets: [
        bar('p50', [19.7, 19.6, 19.9], PALETTE.teal, PALETTE.tealAlpha),
        bar('p95', [24.7, 26.2, 24.8], PALETTE.gray, PALETTE.grayAlpha),
      ],
    },
    options: {
      ...baseOptions(),
      plugins: {
        ...baseOptions().plugins,
        valueLabels: { formatter: (v) => v.toFixed(1) },
      },
    },
    plugins: [valueLabelsPlugin],
  });
}

// ============================================================================
// Рис. 3.7. Redis не ускоряет list / search
// ============================================================================
function drawFig7() {
  const ctx = document.getElementById('chart_fig7');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['list (ESR)', 'search (text)'],
      datasets: [
        bar('Без кэша (OFF)', [65.9, 78.5], PALETTE.magenta, PALETTE.magentaAlpha),
        bar('С Redis', [70.9, 82.1], PALETTE.teal, PALETTE.tealAlpha),
      ],
    },
    options: {
      ...baseOptions(),
      plugins: {
        ...baseOptions().plugins,
        valueLabels: { formatter: (v) => v.toFixed(1) },
      },
    },
    plugins: [valueLabelsPlugin],
  });
}

// ============================================================================
// Рис. 3.8. Сравнение LRU и Redis (p50, p95, max)
// ============================================================================
function drawFig8() {
  const ctx = document.getElementById('chart_fig8');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['p50', 'p95', 'max'],
      datasets: [
        bar('LRU (в памяти)', [2.2, 4.9, 51.0], PALETTE.gray, PALETTE.grayAlpha),
        bar('Redis', [2.3, 3.9, 735.2], PALETTE.teal, PALETTE.tealAlpha),
      ],
    },
    options: {
      ...baseOptions({ yScale: { type: 'logarithmic' } }),
      plugins: {
        ...baseOptions().plugins,
        valueLabels: { formatter: (v) => v.toFixed(1) },
      },
    },
    plugins: [valueLabelsPlugin],
  });
}

// ============================================================================
// Рис. 3.9. Single-flight: дедупликация
// Один датасет с тремя разноцветными столбцами (hits, misses, mongo).
// Делаем backgroundColor массивом, чтобы каждый столбец имел свой цвет.
// ============================================================================
function drawFig9() {
  const ctx = document.getElementById('chart_fig9');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Cache hits', 'Cache misses', 'Mongo queries'],
      datasets: [{
        label: 'Число операций',
        data: [491, 109, 5],
        backgroundColor: [PALETTE.tealAlpha, PALETTE.magentaAlpha, PALETTE.grayAlpha],
        borderColor: [PALETTE.teal, PALETTE.magenta, PALETTE.gray],
        borderWidth: 1.5,
        borderRadius: 2,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
      }],
    },
    options: {
      ...baseOptions(),
      plugins: {
        ...baseOptions().plugins,
        legend: { display: false },
        valueLabels: { formatter: (v) => v.toLocaleString('ru-RU') },
      },
    },
    plugins: [valueLabelsPlugin],
  });
}

// ============================================================================
// Инициализация: ждём Chart.js, потом рендерим все графики.
// Используем IntersectionObserver — рисуем графики только когда они в зоне
// видимости, чтобы не тормозить начальную загрузку страницы.
// ============================================================================
const DRAWERS = {
  fig0: drawFig0, fig1: drawFig1, fig2: drawFig2, fig3: drawFig3, fig4: drawFig4,
  fig5: drawFig5, fig6: drawFig6, fig7: drawFig7, fig8: drawFig8, fig9: drawFig9,
};

function initCharts() {
  if (!window.Chart) {
    setTimeout(initCharts, 100);
    return;
  }
  // Регистрируем плагин подписи значений глобально (он используется во всех графиках)
  // — но Chart.js уже принимает его per-chart в `plugins: [valueLabelsPlugin]`.

  const drawn = new Set();

  // IntersectionObserver следит за появлением канваса на экране.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      const key = card.dataset.chart;
      if (drawn.has(key)) return;
      const drawer = DRAWERS[key];
      if (drawer) {
        drawer();
        drawn.add(key);
      }
    });
  }, { rootMargin: '200px' });

  // Подписываемся на все карточки графиков
  document.querySelectorAll('.figure-card[data-chart]').forEach((card) => {
    observer.observe(card);
  });
}

document.addEventListener('DOMContentLoaded', initCharts);
