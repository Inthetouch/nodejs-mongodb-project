import { promises as fs } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

type SupportedCollection = 'products' | 'users' | 'orders';

export interface ExplainRequest {
  collection: SupportedCollection;
  filter: Record<string, unknown>;
  sort?: Record<string, 1 | -1>;
  projection?: Record<string, 0 | 1>;
  limit?: number;
  label?: string;
}

export interface ExplainSummary {
  collection: SupportedCollection;
  rootStage: string;
  indexUsed: string | null;
  nReturned: number;
  totalDocsExamined: number;
  totalKeysExamined: number;
  executionTimeMillis: number;
  hasInMemorySort: boolean;
  rawSavedTo: string | null;
}

function findIndexName(stage: any): string | null {
  if (!stage) return null;
  if (stage.indexName) return stage.indexName;
  if (stage.inputStage) {
    const found = findIndexName(stage.inputStage);
    if (found) return found;
  }
  if (Array.isArray(stage.inputStages)) {
    for (const child of stage.inputStages) {
      const found = findIndexName(child);
      if (found) return found;
    }
  }
  return null;
}

function hasStageOfType(stage: any, type: string): boolean {
  if (!stage) return false;
  if (stage.stage === type) return true;
  if (stage.inputStage) return hasStageOfType(stage.inputStage, type);
  if (Array.isArray(stage.inputStages)) {
    return stage.inputStages.some((c: any) => hasStageOfType(c, type));
  }
  return false;
}

export class ExplainProfiler {
  constructor(
    private readonly resultsDir: string = path.resolve(process.cwd(), 'results', 'explain'),
  ) {}

  async profile(req: ExplainRequest): Promise<{ summary: ExplainSummary; raw: any }> {
    const conn = mongoose.connection;
    if (conn.readyState !== 1) {
      throw new Error('Mongoose connection is not ready');
    }
    const collection = conn.db!.collection(req.collection);

    let cursor = collection.find(req.filter, { projection: req.projection });
    if (req.sort) cursor = cursor.sort(req.sort);
    if (req.limit !== undefined) cursor = cursor.limit(req.limit);

    const raw: any = await cursor.explain('executionStats');

    const stats = raw.executionStats ?? {};
    const winningPlan = raw.queryPlanner?.winningPlan ?? {};
    const summary: ExplainSummary = {
      collection: req.collection,
      rootStage: winningPlan.stage ?? 'UNKNOWN',
      indexUsed: findIndexName(winningPlan),
      nReturned: stats.nReturned ?? 0,
      totalDocsExamined: stats.totalDocsExamined ?? 0,
      totalKeysExamined: stats.totalKeysExamined ?? 0,
      executionTimeMillis: stats.executionTimeMillis ?? 0,
      hasInMemorySort: hasStageOfType(winningPlan, 'SORT'),
      rawSavedTo: null,
    };

    try {
      await fs.mkdir(this.resultsDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const labelPart = req.label ? `_${req.label.replace(/[^a-z0-9-_]/gi, '')}` : '';
      const filename = `${ts}_${req.collection}${labelPart}.json`;
      const fullPath = path.join(this.resultsDir, filename);
      await fs.writeFile(fullPath, JSON.stringify({ request: req, summary, raw }, null, 2));
      summary.rawSavedTo = fullPath;
    } catch {
    }

    return { summary, raw };
  }
}