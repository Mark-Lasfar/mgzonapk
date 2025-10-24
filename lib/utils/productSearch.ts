import MiniSearch from 'minisearch';
import { connectToDatabase } from '@/lib/db';

let productSearch: MiniSearch<any> | null = null;

export async function getProductSearch() {
  if (productSearch) return productSearch;

  const db = await connectToDatabase();
  const products = await db.collection('products').find({}).toArray();

  productSearch = new MiniSearch({
    fields: ['name', 'description', 'category'],
    storeFields: ['name', 'description', 'category', 'price', 'countInStock'],
    searchOptions: { fuzzy: 0.2, prefix: true },
  });

  productSearch.addAll(products);
  return productSearch;
}