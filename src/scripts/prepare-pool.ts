import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { connectToMongo, disconnectFromMongo } from '../infra/mongo';
import { ProductModel, UserModel } from '../models';

const POOL_CONFIG = {
  hotStep: 1000,
  coldStep: 40,
  coldOffset: 500,
  userStep: 25,
  searchTerms: [
    'concrete', 'plastic', 'fresh', 'elegant', 'sleek',
    'intelligent', 'cotton', 'steel', 'wooden', 'rubber',
  ],
};

async function main() {
  await connectToMongo();

  console.log('[pool] выгружаю все _id продуктов...');
  const allProductDocs = await ProductModel.find()
    .select('_id')
    .sort({ _id: 1 })
    .lean<{ _id: unknown }[]>()
    .exec();
  const allProductIds = allProductDocs.map(d => String(d._id));
  console.log(`[pool] всего продуктов в БД: ${allProductIds.length}`);

  const hotProducts: string[] = [];
  for (let i = 0; i < allProductIds.length; i += POOL_CONFIG.hotStep) {
    hotProducts.push(allProductIds[i]);
  }

  const coldProducts: string[] = [];
  for (let i = POOL_CONFIG.coldOffset; i < allProductIds.length; i += POOL_CONFIG.coldStep) {
    coldProducts.push(allProductIds[i]);
  }

  const hotSet = new Set(hotProducts);
  const intersection = coldProducts.filter(id => hotSet.has(id));
  if (intersection.length > 0) {
    throw new Error(`пулы пересекаются на ${intersection.length} элементах — ошибка генерации`);
  }
  console.log(`[pool] горячий пул: ${hotProducts.length} элементов`);
  console.log(`[pool] холодный пул: ${coldProducts.length} элементов`);
  console.log(`[pool] пересечений нет`);

  console.log('[pool] выгружаю пользователей...');
  const allUserDocs = await UserModel.find()
    .select('_id')
    .sort({ _id: 1 })
    .lean<{ _id: unknown }[]>()
    .exec();
  const allUserIds = allUserDocs.map(d => String(d._id));
  const users: string[] = [];
  for (let i = 0; i < allUserIds.length; i += POOL_CONFIG.userStep) {
    users.push(allUserIds[i]);
  }
  console.log(`[pool] пользователей: ${users.length}`);

  const pool = {
    generatedAt: new Date().toISOString(),
    sourceCounts: {
      products: allProductIds.length,
      users: allUserIds.length,
    },
    hotProducts,
    coldProducts,
    users,
    searchTerms: POOL_CONFIG.searchTerms,
  };

  const outDir = path.resolve(process.cwd(), 'load-tests');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'pool.json');
  await fs.writeFile(outPath, JSON.stringify(pool, null, 2));
  console.log(`[pool] сохранено: ${outPath}`);

  await disconnectFromMongo();
  process.exit(0);
}

main().catch((err) => {
  console.error('[pool] ошибка:', err);
  process.exit(1);
});