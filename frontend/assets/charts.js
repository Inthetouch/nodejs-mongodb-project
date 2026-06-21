// ============================================================================
// Chart.js-графики в академическом стиле matplotlib.
// Поддерживают переключение тем (светлая/тёмная) — при смене темы все графики
// перерисовываются с новой палитрой. Подписи значений над столбцами через
// кастомный плагин valueLabelsPlugin.
// ============================================================================

// --- Палитра: пересчитывается по текущей теме ---
// Сами цвета столбцов (бирюзовый, серый, бежевый, малиновый) одинаковые в обеих
// темах — они контрастны и на белом, и на тёмном. Меняются только цвета текста,
// сетки и осей — те, что должны быть «противоположны фону».
function getPalette() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const css = getComputedStyle(document.documentElement);
  return {
    teal: '#0E7C7B',
    tealAlpha: 'rgba(14, 124, 123, 0.85)',
    gray: isDark ? '#a8aebd' : '#8E8E8E',
    grayAlpha: isDark ? 'rgba(168, 174, 189, 0.7)' : 'rgba(142, 142, 142, 0.85)',
    beige: isDark ? '#bca878' : '#D5CFC0',
    beigeAlpha: isDark ? 'rgba(188, 168, 120, 0.75)' : 'rgba(213, 207, 192, 0.85)',
    magenta: '#C2185B',
    magentaAlpha: 'rgba(194, 24, 91, 0.85)',
    text: css.getPropertyValue('--text-primary').trim() || (isDark ? '#e8eaed' : '#1f2937'),
    grid: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    axisBorder: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
  };
}

// --- Плагин: подписи значений над столбцами ---
// Цвет берётся динамически из getPalette().text, чтобы корректно работать
// после переключения темы (после destroy+перерисовки).
const valueLabelsPlugin = {
  id: 'valueLabels',
  afterDatasetsDraw(chart, args, opts) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = opts.color || getPalette().text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    chart.data.datasets.forEach((dataset, dsIdx) => {
      const meta = chart.getDatasetMeta(dsIdx);
      meta.data.forEach((barElem, idx) => {
        const value = dataset.data[idx];
        if (value === null || value === undefined) return;
        const formatted = opts.formatter ? opts.formatter(value) : String(value);
        ctx.fillText(formatted, barElem.x, barElem.y - 4);
      });
    });
    ctx.restore();
  },
};

// --- Базовые настройки графика ---
// Функция, а не константа — обращается к свежей палитре при каждом построении.
function baseOptions(extra = {}) {
  const p = getPalette();
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 24, right: 12, bottom: 8, left: 8 } },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: p.text,
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
        border: { color: p.axisBorder },
        ticks: { color: p.text, font: { size: 12, weight: '500' } },
      },
      y: {
        grid: { color: p.grid, drawTicks: false },
        border: { display: false },
        ticks: { color: p.text, font: { size: 11 }, padding: 8 },
        beginAtZero: true,
        ...(extra.yScale || {}),
      },
    },
    animation: { duration: 600, easing: 'easeOutQuart' },
  };
}

// --- Хелпер для датасета ---
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

// --- Хранилище экземпляров: нужно для destroy+перерисовки при смене темы ---
const chartInstances = {};
function registerChart(key, chart) {
  if (chartInstances[key]) chartInstances[key].destroy();
  chartInstances[key] = chart;
}

// ============================================================================
// Графики 3.0 — 3.9
// ============================================================================

function drawFig0() {
  const ctx = document.getElementById('chart_fig0');
  if (!ctx) return;
  const p = getPalette();
  registerChart('fig0', new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'Простые индексы', 'ESR-индексы'],
      datasets: [bar('Просмотрено документов', [200000, 24085, 10], p.teal, p.tealAlpha)],
    },
    options: {
      ...baseOptions({ yScale: { type: 'logarithmic' } }),
      plugins: {
        ...baseOptions().plugins,
        valueLabels: { formatter: (v) => v.toLocaleString('ru-RU') },
      },
    },
    plugins: [valueLabelsPlugin],
  }));
}

function drawFig1() {
  const ctx = document.getElementById('chart_fig1');
  if (!ctx) return;
  const p = getPalette();
  registerChart('fig1', new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'Простые индексы', 'ESR-индексы'],
      datasets: [
        bar('p50', [607, 143, 66], p.teal, p.tealAlpha),
        bar('p95', [749, 453, 223], p.gray, p.grayAlpha),
        bar('p99', [823, 567, 293], p.beige, p.beigeAlpha),
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
  }));
}

function drawFig2() {
  const ctx = document.getElementById('chart_fig2');
  if (!ctx) return;
  const p = getPalette();
  registerChart('fig2', new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'Простые индексы', 'ESR-индексы'],
      datasets: [
        bar('p50', [9.7, 9.5, 9.7], p.teal, p.tealAlpha),
        bar('p95', [14.9, 14.4, 14.7], p.gray, p.grayAlpha),
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
  }));
}

function drawFig3() {
  const ctx = document.getElementById('chart_fig3');
  if (!ctx) return;
  const p = getPalette();
  registerChart('fig3', new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'Простые индексы', 'ESR-индексы'],
      datasets: [
        bar('Read p50', [11.5, 11.0, 11.2], p.teal, p.tealAlpha),
        bar('Write p50', [26.0, 25.6, 25.6], p.magenta, p.magentaAlpha),
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
  }));
}

function drawFig4() {
  const ctx = document.getElementById('chart_fig4');
  if (!ctx) return;
  const p = getPalette();
  registerChart('fig4', new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'ESR-индексы'],
      datasets: [
        bar('Без кэша (OFF)', [9.7, 9.7], p.magenta, p.magentaAlpha),
        bar('С Redis', [2.3, 2.3], p.teal, p.tealAlpha),
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
  }));
}

function drawFig5() {
  const ctx = document.getElementById('chart_fig5');
  if (!ctx) return;
  const p = getPalette();
  registerChart('fig5', new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'Простые индексы', 'ESR-индексы'],
      datasets: [
        bar('Read p50', [4.5, 4.5, 4.5], p.teal, p.tealAlpha),
        bar('Write p50', [17.5, 17.0, 17.0], p.magenta, p.magentaAlpha),
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
  }));
}

function drawFig6() {
  const ctx = document.getElementById('chart_fig6');
  if (!ctx) return;
  const p = getPalette();
  registerChart('fig6', new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Без индексов', 'Простые индексы', 'ESR-индексы'],
      datasets: [
        bar('p50', [19.7, 19.6, 19.9], p.teal, p.tealAlpha),
        bar('p95', [24.7, 26.2, 24.8], p.gray, p.grayAlpha),
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
  }));
}

function drawFig7() {
  const ctx = document.getElementById('chart_fig7');
  if (!ctx) return;
  const p = getPalette();
  registerChart('fig7', new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['list (ESR)', 'search (text)'],
      datasets: [
        bar('Без кэша (OFF)', [65.9, 78.5], p.magenta, p.magentaAlpha),
        bar('С Redis', [70.9, 82.1], p.teal, p.tealAlpha),
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
  }));
}

function drawFig8() {
  const ctx = document.getElementById('chart_fig8');
  if (!ctx) return;
  const p = getPalette();
  registerChart('fig8', new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['p50', 'p95', 'max'],
      datasets: [
        bar('LRU (в памяти)', [2.2, 4.9, 51.0], p.gray, p.grayAlpha),
        bar('Redis', [2.3, 3.9, 735.2], p.teal, p.tealAlpha),
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
  }));
}

function drawFig9() {
  const ctx = document.getElementById('chart_fig9');
  if (!ctx) return;
  const p = getPalette();
  registerChart('fig9', new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Cache hits', 'Cache misses', 'Mongo queries'],
      datasets: [{
        label: 'Число операций',
        data: [491, 109, 5],
        backgroundColor: [p.tealAlpha, p.magentaAlpha, p.grayAlpha],
        borderColor: [p.teal, p.magenta, p.gray],
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
  }));
}

// ============================================================================
// Инициализация и перерисовка при смене темы
// ============================================================================
const DRAWERS = {
  fig0: drawFig0, fig1: drawFig1, fig2: drawFig2, fig3: drawFig3, fig4: drawFig4,
  fig5: drawFig5, fig6: drawFig6, fig7: drawFig7, fig8: drawFig8, fig9: drawFig9,
};

// Множество ключей графиков, которые уже хотя бы раз нарисованы.
// При смене темы перерисовываем только их.
const drawn = new Set();

function drawIfNeeded(key) {
  const drawer = DRAWERS[key];
  if (!drawer) return;
  drawer();
  drawn.add(key);
}

function redrawAll() {
  drawn.forEach((key) => drawIfNeeded(key));
}

function initCharts() {
  if (!window.Chart) {
    setTimeout(initCharts, 100);
    return;
  }
  // Lazy-рендеринг: рисуем график только когда карточка попадает в зону видимости.
  // rootMargin: '200px' — начинаем рендеринг чуть раньше попадания в видимую область,
  // чтобы пользователь не видел пустые карточки при прокрутке.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const key = entry.target.dataset.chart;
      if (drawn.has(key)) return;
      drawIfNeeded(key);
    });
  }, { rootMargin: '200px' });

  document.querySelectorAll('.figure-card[data-chart]').forEach((card) => {
    observer.observe(card);
  });

  // Перерисовка при смене темы. Используем MutationObserver на data-theme.
  const themeObserver = new MutationObserver(() => redrawAll());
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

document.addEventListener('DOMContentLoaded', initCharts);
