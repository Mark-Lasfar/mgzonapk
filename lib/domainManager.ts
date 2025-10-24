// /lib/domainManager.ts
import { connectToDatabase } from '@/lib/db';
import Store from '@/lib/db/models/store.model';
import dns from 'dns';
import { promisify } from 'util';

const resolveCname = promisify(dns.resolveCname);

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

export async function verifyDomain(domain: string): Promise<boolean> {
  try {
    const cnameRecords = await resolveCname(domain);
    const expectedCname = process.env.VERCEL_DOMAIN || 'cname.vercel-dns.com';
    return cnameRecords.includes(expectedCname);
  } catch (error) {
    return false;
  }
}

async function addCustomDomain(storeName: string, customDomain?: string): Promise<string> {
  try {
    let domain = `https://${storeName}.vercel.app`;
    if (customDomain) {
      const isVerified = await verifyDomain(customDomain);
      if (!isVerified) {
        throw new Error('Domain verification failed: Invalid CNAME record');
      }
      domain = `https://${customDomain}`;
    }
    return domain;
  } catch (error) {
    throw new Error(`Failed to add domain: ${(error as Error).message}`);
  }
}

export async function assignDomain(storeId: string, storeName: string, plan: string, customDomain?: string): Promise<string> {
  await connectToDatabase();
  const existingNames = (await Store.find({}).select('name')).map((s: any) => s.name);
  const businessName = await registerStoreName(storeName, existingNames);
  const domain = plan === 'trial' ? `https://hager-zon.vercel.app/${businessName}` : await addCustomDomain(businessName, customDomain);

  await Store.updateOne(
    { storeId },
    {
      $set: { name: businessName },
      $push: {
        domains: {
          domainName: domain,
          isPrimary: !customDomain, // Default domain is primary unless custom domain is added
          dnsStatus: customDomain ? 'pending' : 'verified',
        },
      },
    }
  );
  return domain;
}