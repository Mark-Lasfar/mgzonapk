export async function importProductsFromAmazon(
    credentials: { accessToken: string },
    storeId: string
  ): Promise<any[]> {
    try {
      const response = await fetch('https://sellingpartnerapi.amazon.com/v1/products', {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.items.map((p: any) => ({
        name: p.title,
        price: parseFloat(p.price || '0'),
        image: p.image || '/default-product.jpg',
        slug: p.asin || `p-${Date.now()}`,
        description: p.description || '',
        storeId,
      }));
    } catch (error) {
      throw new Error(`Failed to import products from Amazon: ${(error as Error).message}`);
    }
  }