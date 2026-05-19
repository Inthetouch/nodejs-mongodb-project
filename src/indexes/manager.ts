import mongoose from 'mongoose';
import type { Db, Collection, IndexDescription } from 'mongodb';
import {
  type IndexProfile,
  type IndexProfileName,
  type IndexDefinition,
  getProfile,
} from './profiles';

const PROTECTED_INDEX_NAMES = new Set<string>(['_id_', 'email_1', 'sku_1']);

const MANAGED_COLLECTIONS = ['products', 'users', 'orders'] as const;
type ManagedCollection = (typeof MANAGED_COLLECTIONS)[number];

export interface ExistingIndexInfo {
  name: string;
  key: Record<string, unknown>;
  managed: boolean;
  protected: boolean;
}

export interface CollectionState {
  collection: ManagedCollection;
  indexes: ExistingIndexInfo[];
}

export interface DiffPlanItem {
  collection: ManagedCollection;
  toCreate: IndexDefinition[];
  toDrop: string[];
}

export interface DiffPlan {
  profile: IndexProfileName;
  items: DiffPlanItem[];
  noop: boolean;
}

export interface ApplyResult {
  profile: IndexProfileName;
  plan: DiffPlan;
  created: Array<{ collection: ManagedCollection; name: string }>;
  dropped: Array<{ collection: ManagedCollection; name: string }>;
  errors: Array<{
    collection: ManagedCollection;
    name: string;
    action: 'create' | 'drop';
    message: string;
  }>;
  durationMs: number;
}

export class IndexManager {
  private lastAppliedProfile: IndexProfileName;

  constructor(initialProfile: IndexProfileName) {
    this.lastAppliedProfile = initialProfile;
  }

  getLastAppliedProfile(): IndexProfileName {
    return this.lastAppliedProfile;
  }

  private getDb(): Db {
    const conn = mongoose.connection;
    if (conn.readyState !== 1) {
      throw new Error('Mongoose connection is not ready');
    }
    return conn.db as Db;
  }

  private getCollection(name: ManagedCollection): Collection {
    return this.getDb().collection(name);
  }

  async getState(profileForMarking?: IndexProfileName): Promise<CollectionState[]> {
    const profile: IndexProfile | null = profileForMarking ? getProfile(profileForMarking) : null;
    const result: CollectionState[] = [];

    for (const name of MANAGED_COLLECTIONS) {
      const collection = this.getCollection(name);
      const raw: IndexDescription[] = await collection.indexes();

      const expectedNames = new Set<string>(
        profile?.collections[name]?.map(def => def.name) ?? [],
      );

      const indexes: ExistingIndexInfo[] = raw.map(idx => ({
        name: String(idx.name),
        key: (idx.key ?? {}) as Record<string, unknown>,
        managed: profile ? expectedNames.has(String(idx.name)) : false,
        protected: PROTECTED_INDEX_NAMES.has(String(idx.name)),
      }));

      result.push({ collection: name, indexes });
    }

    return result;
  }

  async diff(profileName: IndexProfileName): Promise<DiffPlan> {
    const profile = getProfile(profileName);
    const state = await this.getState(profileName);

    const items: DiffPlanItem[] = [];

    for (const name of MANAGED_COLLECTIONS) {
      const existingState = state.find(s => s.collection === name)!;
      const existingNames = new Set(
        existingState.indexes
          .filter(i => !i.protected)
          .map(i => i.name),
      );

      const wanted: IndexDefinition[] = profile.collections[name] ?? [];
      const wantedNames = new Set(wanted.map(def => def.name));

      const toCreate = wanted.filter(def => !existingNames.has(def.name));
      const toDrop = Array.from(existingNames).filter(n => !wantedNames.has(n));

      items.push({ collection: name, toCreate, toDrop });
    }

    const noop = items.every(item => item.toCreate.length === 0 && item.toDrop.length === 0);

    return { profile: profileName, items, noop };
  }

  async apply(profileName: IndexProfileName): Promise<ApplyResult> {
    const startedAt = Date.now();
    const plan = await this.diff(profileName);

    const created: ApplyResult['created'] = [];
    const dropped: ApplyResult['dropped'] = [];
    const errors: ApplyResult['errors'] = [];

    for (const item of plan.items) {
      const collection = this.getCollection(item.collection);
      for (const def of item.toCreate) {
        try {
          await collection.createIndex(def.key, { ...def.options, name: def.name });
          created.push({ collection: item.collection, name: def.name });
        } catch (err) {
          errors.push({
            collection: item.collection,
            name: def.name,
            action: 'create',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    for (const item of plan.items) {
      const collection = this.getCollection(item.collection);
      for (const indexName of item.toDrop) {
        try {
          await collection.dropIndex(indexName);
          dropped.push({ collection: item.collection, name: indexName });
        } catch (err) {
          errors.push({
            collection: item.collection,
            name: indexName,
            action: 'drop',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    this.lastAppliedProfile = profileName;

    return {
      profile: profileName,
      plan,
      created,
      dropped,
      errors,
      durationMs: Date.now() - startedAt,
    };
  }
}