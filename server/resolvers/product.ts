import { ProductInput } from '@/lib/types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const resolvers = {
  Mutation: {
    createProduct: async (_: any, { input }: { input: ProductInput }) => {
      const { pricing, ...rest } = input;
      return prisma.product.create({
        data: {
          ...rest,
          pricing: {
            basePrice: pricing.basePrice,
            markup: pricing.markup,
            profit: pricing.profit,
            commission: pricing.commission,
            finalPrice: pricing.finalPrice,
            currency: pricing.currency,
            discount: pricing.discount ? {
              type: pricing.discount.type,
              value: pricing.discount.value,
              startDate: pricing.discount.startDate,
              endDate: pricing.discount.endDate,
            } : null,
          },
        },
      });
    },
    updateProduct: async (_: any, { id, input }: { id: string; input: ProductInput }) => {
      const { pricing, ...rest } = input;
      return prisma.product.update({
        where: { id },
        data: {
          ...rest,
          pricing: {
            basePrice: pricing.basePrice,
            markup: pricing.markup,
            profit: pricing.profit,
            commission: pricing.commission,
            finalPrice: pricing.finalPrice,
            currency: pricing.currency,
            discount: pricing.discount ? {
              type: pricing.discount.type,
              value: pricing.discount.value,
              startDate: pricing.discount.startDate,
              endDate: pricing.discount.endDate,
            } : null,
          },
        },
      });
    },
    importDropshippingProduct: async (_: any, { providerId, externalProductId }: { providerId: string; externalProductId: string }) => {
      // Mock implementation: Replace with actual logic to fetch product from dropshipping provider
      const dropshippingProduct = {
        name: 'Imported Product',
        description: 'Description from dropshipping provider',
        price: 99.99,
        images: ['https://example.com/image.jpg'],
        externalSku: 'DS-12345',
      };

      // Example: Save to database and return relevant fields
      const product = await prisma.product.create({
        data: {
          name: dropshippingProduct.name,
          description: dropshippingProduct.description,
          price: dropshippingProduct.price,
          listPrice: dropshippingProduct.price,
          countInStock: 0,
          category: 'Imported',
          brand: 'Dropshipping',
          featured: false,
          isPublished: false,
          pricing: {
            basePrice: dropshippingProduct.price,
            finalPrice: dropshippingProduct.price,
            currency: 'USD',
          },
          images: dropshippingProduct.images,
          dropshipping: {
            provider: providerId,
            externalProductId,
            externalSku: dropshippingProduct.externalSku,
          },
          translations: [{ locale: 'en', name: dropshippingProduct.name, description: dropshippingProduct.description }],
          sections: [],
          layout: 'default',
          tags: ['dropshipping'],
          sellerId: 'some-seller-id', // Replace with actual seller ID
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      return {
        name: product.name,
        description: product.description,
        price: product.price,
        images: product.images,
        sku: product.dropshipping?.externalSku,
      };
    },
  },
};