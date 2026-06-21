# Node.js × MongoDB · Сравнительный анализ кэширования и индексирования

Экспериментальный программный стенд и веб-дашборд для магистерской ВКР на тему
«Исследование и оптимизация производительности Node.js-приложений: сравнительный
анализ стратегий кэширования и индексирования».

**Демо-дашборд:** https://inthetouch.github.io/nodejs-mongodb-project/

---

## О проекте

Стенд имитирует backend интернет-магазина с базой 200 000 товаров, 50 000 пользователей
и 100 000 заказов. На нём проводится **22 нагрузочных эксперимента** — четыре
индексных профиля × три реализации кэша × разные сценарии нагрузки. 

Цель — сравнить, что и насколько ускоряет реальные веб-приложения: индексы базы данных,
внешний кэш (Redis), внутрипроцессный кэш (LRU), или их сочетания.

Главные результаты:

- **9×** ускорение списочных запросов от составного индекса по правилу ESR
- **4×** ускорение точечных чтений по ID от Redis-кэша
- **22×** дедупликация лавины запросов через паттерн single-flight
- **<1%** реальная стоимость индексов при транзакционной записи

Все числа получены на реальном стенде, JSON-выгрузки прогонов лежат в репозитории
и подаются в дашборд.

## Стек

| Слой | Технология |
|------|------------|
| Runtime | Node.js 25 |
| Язык | TypeScript |
| Веб-фреймворк | Fastify 5.8 |
| База данных | MongoDB 7.0 (replica set, для совместимости с транзакциями) |
| ODM | Mongoose 9.6 + нативный драйвер для горячих путей |
| Кэш | Redis 7.2 (ioredis 5.10) + lru-cache 11.4 |
| Метрики | prom-client 15.1 (Prometheus-совместимые) |
| Нагрузка | Grafana k6 |
| Инфраструктура | Docker Compose |
| Дашборд | HTML + CSS Grid + Chart.js 4.4 (без сборки) |

## Структура репозитория

```
nodejs-mongodb-project/
├── src/                          # Backend (TypeScript + Fastify)
│   ├── config/                   # Конфиг из .env
│   ├── infra/                    # Подключения mongo/redis
│   ├── models/                   # Mongoose-схемы Product/User/Order
│   ├── repositories/             # Слой данных: mongoose/ и native/
│   ├── cache/                    # CacheService: noop, lru, redis
│   ├── indexes/                  # IndexManager + 4 профиля индексов
│   ├── explain/                  # Profiler — обёртка над explain('executionStats')
│   ├── metrics/                  # prom-client метрики + middleware
│   ├── routes/                   # HTTP-маршруты (products, orders, admin/*)
│   ├── services/                 # Бизнес-логика
│   ├── scripts/                  # seed.ts, prepare-pool.ts
│   └── server.ts                 # Точка входа Fastify
│
├── load-tests/                   # Сценарии k6 + оркестратор
│   ├── lib/pool.js               # Подключение пула id (горячие/холодные)
│   ├── read-heavy.js             # Чтение по ID
│   ├── read-list-heavy.js        # Списки с фильтрами
│   ├── search-heavy.js           # Текстовый поиск
│   ├── write-heavy.js            # Запись (POST /orders)
│   ├── mixed.js                  # 95% read / 5% write
│   ├── single-flight.js          # Микроэксперимент Cache Stampede
│   ├── run-matrix.ts             # Оркестратор: матрица 22 прогонов
│   └── pool.json                 # Сгенерированный пул id
│
├── frontend/                     # Статический дашборд для GitHub Pages
│   ├── index.html
│   ├── assets/
│   │   ├── style.css
│   │   ├── app.js                # Навигация, таблица, темы
│   │   └── charts.js             # 10 графиков Chart.js
│   └── data/runs.json            # Агрегат всех 22 прогонов
│
│
├── .github/workflows/
│   └── deploy-pages.yml          # CI: автодеплой frontend/ на GitHub Pages
│
├── docker-compose.yml            # MongoDB replica set + Redis с LRU-eviction
├── .env.example                  # Шаблон переменных окружения
├── package.json
├── tsconfig.json
└── README.md                     
```

## Архитектура backend

Стенд построен по слоистой архитектуре:

```
HTTP-запрос
   ↓
routes/         # Fastify-маршруты, валидация JSON Schema
   ↓
services/       # Бизнес-логика (ProductService и т.д.)
   ↓
cache/          # MetricsCacheService → RedisCacheService / LruCacheService / NoOpCacheService
   ↓ (промах)
repositories/   # Mongoose- или native-репозиторий
   ↓
MongoDB
```

**Ключевые архитектурные решения:**

- **CacheService как абстракция** — единый интерфейс для трёх реализаций, переключается
  через переменную окружения `CACHE_IMPL=none|lru|redis`. Сервисы не зависят от
  реализации кэша.

- **Single-flight внутри кэша** — `Map<key, Promise>` дедуплицирует параллельные
  промахи одного ключа. Реализован в `RedisCacheService.getOrLoad` и
  `LruCacheService.getOrLoad`. Защищает базу от лавины запросов при истечении TTL
  у горячего ключа.

- **MetricsCacheService как декоратор** — обёртка над любым `CacheService`,
  считает попадания/промахи через `prom-client`. Подменяется без изменения
  бизнес-логики.

- **IndexManager** — управляет индексами на лету. Метод `apply(profile)` приводит
  состояние MongoDB к одному из четырёх профилей: `none`, `single`, `esr`, `text`.
  Защищает системные индексы (`_id_`, `email_1`, `sku_1`) — их не трогает.

- **Mongoose + native-репозиторий** — на горячем пути read-by-id используется
  нативный драйвер MongoDB, чтобы избежать накладных расходов на гидратацию
  моделей Mongoose. Выбор репозитория через `REPOSITORY_IMPL`.

## Запуск стенда

### Предварительные требования

- Docker и Docker Compose
- Node.js 20+ и npm
- Grafana k6 (для нагрузочных тестов)

### Шаги

```bash
# 1. Установить зависимости
npm install

# 2. Скопировать конфиг и поменять ADMIN_TOKEN на свой
cp .env.example .env

# 3. Поднять MongoDB и Redis в Docker
npm run infra:up

# 4. Засеять датасет (200K товаров, 50K пользователей, 100K заказов, ~30-60 сек)
npm run seed

# 5. Сгенерировать пул горячих/холодных id для нагрузочных сценариев
npm run pool

# 6. Запустить сервер в режиме разработки (watch + tsx)
npm run dev
```

Сервер слушает на `http://localhost:3000`. Проверка работоспособности:

```bash
curl -s http://localhost:3000/admin/stats -H "X-Admin-Token: $ADMIN_TOKEN" | jq
```

## Запуск нагрузочных экспериментов

### Один сценарий вручную

```bash
# Применить ESR-индексы
curl -X POST http://localhost:3000/admin/indexes \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{"profile":"esr"}'

# Запустить нагрузку: 50 пользователей, 30 секунд
k6 run --vus 50 --duration 30s \
  --env BASE_URL=http://localhost:3000 \
  load-tests/read-heavy.js
```

### Вся матрица 22 прогонов

```bash
npm run matrix
```

Этот скрипт сам переключает индексные профили и реализации кэша между прогонами,
делает прогрев, снимает метрики и сохраняет результаты как `.summary.json` и
`.stats.json` для каждого прогона.

## Админ-маршруты

Все защищены токеном через заголовок `X-Admin-Token`. По умолчанию токен —
`change-me-please` (из `.env.example`).

| Маршрут | Назначение |
|---------|------------|
| `GET /admin/stats` | Метрики приложения: hits/misses/hitRate, обращения к Mongo |
| `POST /admin/indexes` | Применить индексный профиль (`none`, `single`, `esr`, `text`) |
| `GET /admin/indexes` | Текущее состояние индексов |
| `POST /admin/indexes/dry-run` | Сухой прогон: что было бы создано/удалено |
| `GET /admin/indexes/profiles` | Перечень доступных профилей |
| `POST /admin/cache/flush` | Сбросить кэш |
| `POST /admin/cleanup` | Очистить тестовые данные |
| `POST /admin/explain` | Запустить explain для запроса и получить план |
| `GET /metrics` | Prometheus-формат, без токена |

## Сценарии нагрузки

| Файл | Профиль | VU | Описание |
|------|---------|----|----------|
| `read-heavy.js` | 100% read by ID | 50 | Чтение горячих/холодных товаров с распределением Парето 80/20 |
| `read-list-heavy.js` | 100% read list | 50 | Запросы со списками: фильтр по категории, рейтингу, цене |
| `search-heavy.js` | 100% search | 30 | Полнотекстовый поиск через text-индекс |
| `write-heavy.js` | 100% write | 30 | POST /orders, проверка стоимости индексов при записи |
| `mixed.js` | 95% read / 5% write | 50 | Имитация реальной нагрузки магазина |
| `single-flight.js` | Cache Stampede | 100 | 100 одновременных запросов в момент истечения TTL |

## Дашборд

Статический сайт в папке `frontend/` показывает результаты всех 22 прогонов.
Автодеплой через GitHub Actions при пуше в `main` с изменениями в `frontend/**`.

## Переменные окружения

Полный список в `.env.example`. 

Ключевые:

| Переменная | По умолчанию | Назначение |
|------------|--------------|------------|
| `PORT` | `3000` | HTTP-порт Fastify |
| `MONGO_URI` | `mongodb://localhost:27017/bench?replicaSet=rs0` | Подключение к MongoDB |
| `REDIS_URL` | `redis://localhost:6379` | Подключение к Redis |
| `CACHE_ENABLED` | `false` | Включить кэширование |
| `CACHE_IMPL` | `redis` | Реализация: `none`, `lru`, `redis` |
| `CACHE_TTL_SECONDS` | `60` | TTL по умолчанию |
| `USE_LEAN` | `true` | Использовать `lean()` в Mongoose (без гидратации) |
| `REPOSITORY_IMPL` | `mongoose` | Источник данных: `mongoose` или `native` |
| `INITIAL_INDEX_PROFILE` | `none` | Какой профиль применить при старте сервера |
| `ADMIN_TOKEN` | `change-me-please` | Сменить при необходимости |

## Воспроизводимость

- Генерация данных с фиксированным seed — повторный запуск создаёт идентичный датасет
- Пул id (`pool.json`) — детерминированный список горячих и холодных идентификаторов
- Снимки конфигурации (`env.snapshot.*`) сохраняются вместе с результатами
- Контейнеризация через Docker гарантирует одинаковое окружение

Чтобы воспроизвести результаты ВКР на своей машине, достаточно склонировать
репозиторий, выполнить шаги «Запуск стенда» и `npm run matrix`. Получишь те же
22 файла результатов.

## Среда тестирования (использовалась в работе)

- **CPU:** Intel Core i7-12700KF (20 потоков)
- **RAM:** 16 ГБ DDR4
- **OS:** Linux 6.18 (WSL2 на Windows 11)
- **Docker:** 29.4.3 + Docker Compose 5.1.4
- **Node.js:** 25.9.0
- **MongoDB:** 7.0.34
- **Redis:** 7.2 Alpine

Абсолютные значения латентности специфичны для этой конфигурации. Качественные
выводы (ESR на 9×, Redis на 4×, single-flight на 22×) сохраняются и в других
средах — это зафиксировано в подразделе 3.13 ВКР.
