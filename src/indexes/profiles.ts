import type { IndexSpecification, CreateIndexesOptions } from 'mongodb';

export type IndexProfileName = 'none' | 'single' | 'esr' | 'text';

export const INDEX_PROFILE_NAMES: readonly IndexProfileName[] = [
  'none',
  'single',
  'esr',
  'text',
] as const;

export interface IndexDefinition {
  name: string;
  key: IndexSpecification;
  options?: Omit<CreateIndexesOptions, 'name'>;
}

export interface IndexProfile {
  name: IndexProfileName;
  description: string;
  collections: {
    products?: IndexDefinition[];
    users?: IndexDefinition[];
    orders?: IndexDefinition[];
  };
}

const profileNone: IndexProfile = {
  name: 'none',
  description: 'Baseline: только _id_ + unique-индексы из Mongoose schema (email_1, sku_1).',
  collections: {},
};

const profileSingle: IndexProfile = {
  name: 'single',
  description: 'Одиночные индексы на самых селективных полях (п. 2.5.1 ВКР).',
  collections: {
    products: [
      { name: 'idx_category', key: { category: 1 } },
    ],
    orders: [
      { name: 'idx_userId', key: { userId: 1 } },
      { name: 'idx_createdAt', key: { createdAt: -1 } },
    ],
  },
};

const profileEsr: IndexProfile = {
  name: 'esr',
  description: 'Составные ESR-индексы (п. 2.5.2 ВКР).',
  collections: {
    products: [
      {
        name: 'idx_category_rating_price',
        key: { category: 1, rating: -1, price: 1 },
      },
    ],
    orders: [
      {
        name: 'idx_userId_status_createdAt',
        key: { userId: 1, status: 1, createdAt: -1 },
      },
    ],
  },
};

const profileText: IndexProfile = {
  name: 'text',
  description: 'ESR-индексы + полнотекстовый индекс products (title + description).',
  collections: {
    products: [
      {
        name: 'idx_category_rating_price',
        key: { category: 1, rating: -1, price: 1 },
      },
      {
        name: 'idx_text_title_description',
        key: { title: 'text', description: 'text' },
        options: {
          weights: { title: 5, description: 1 },
        },
      },
    ],
    orders: [
      {
        name: 'idx_userId_status_createdAt',
        key: { userId: 1, status: 1, createdAt: -1 },
      },
    ],
  },
};

export const INDEX_PROFILES: Record<IndexProfileName, IndexProfile> = {
  none: profileNone,
  single: profileSingle,
  esr: profileEsr,
  text: profileText,
};

export function getProfile(name: IndexProfileName): IndexProfile {
  const p = INDEX_PROFILES[name];
  if (!p) throw new Error(`Unknown index profile: ${name}`);
  return p;
}