// /lib/domainManager.ts
import { connectToDatabase } from '@/lib/db';
import Store from '@/lib/db/models/store.model';

async function registerStoreName(baseName: string, existingNames: string[]): Promise<string> {
  const suggestions = [
    `${baseName}-${Math.floor(Math.random() * 100)}`,
    `${baseName}-shop`,
    `${baseName}-online`,
    `${baseName}-store`,
  ];
  for (const suggestion of suggestions) {
    if (!existingNames.includes(suggestion)) {
      return suggestion;
    }
  }
  throw new Error('No available name suggestions');
}

async function addCustomDomain(storeName: string): Promise<any> {
  try {
    const response = await fetch(
      'https://api.vercel.com/v9/projects/prj_RTwTbmLs7VZxB6uNRn6TJmE2iRfq/domains',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: `${storeName}.vercel.app` }),
      }
    );
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }
    return data;
  } catch (error) {
    throw new Error(`Failed to add domain: ${(error as Error).message}`);
  }
}

export async function assignDomain(storeId: string, storeName: string, plan: string): Promise<string> {
  await connectToDatabase();
  const existingNames = (await Store.find({}).select('name')).map((s: any) => s.name);
  const finalName = await registerStoreName(storeName, existingNames);
  const domain =
    plan === 'trial'
      ? `https://hager-zon.vercel.app/${finalName}`
      : `https://${finalName}.vercel.app`;

  if (plan !== 'trial') {
    await addCustomDomain(finalName);
  }

  await Store.updateOne(
    { storeId },
    { $set: { name: finalName, domain } }
  );
  return domain;
}