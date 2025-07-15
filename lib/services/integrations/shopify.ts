export async function importProductsFromShopify(credentials: { shop: string; accessToken: string }, storeId: string ) {
    try {
      const response = await fetch(`https://${credentials.shop}/admin/api/2024-04/products.json`, {
        headers: {
          'X-Shopify-Access-Token': credentials.accessToken,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      return data.products.map((product: any) => ({
        name: product.title,
        price: parseFloat(product.variants[0].price),
        image: product.images[0]?.src || '/default-product.jpg',
        slug: product.handle,
        description: product.body_html,
        storeId,
      }));
    } catch (error) {
      throw new Error(`Failed to import Shopify products: ${error.message}`);
    }
  }