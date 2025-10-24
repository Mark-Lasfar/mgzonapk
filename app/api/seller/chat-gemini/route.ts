import { GoogleGenerativeAI, FunctionCall, FunctionResponse } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, customLogger } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import Template from '@/lib/db/models/template.model';
import Product from '@/lib/db/models/product.model';
import ChatHistory from '@/lib/db/models/chatHistory.model';
import { nanoid } from 'nanoid';
import JSON5 from 'json5';
import { getSession } from 'next-auth/react';
import { LRUCache } from 'lru-cache';
import { z } from 'zod';
import { schedule } from 'node-cron';

schedule('0 0 * * *', async () => {
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  await ChatHistory.deleteMany({ updatedAt: { $lt: tenDaysAgo } });
  customLogger.info('Old chat histories cleaned up', { service: 'cron' });
});

// تعريف مخططات Zod للتحقق من البيانات
const createTemplateSchema = z.object({
  sellerId: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id)),
  name: z.string().min(1),
  theme: z.enum(['light', 'dark']),
  font: z.string().min(1),
  colors: z.object({
    primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
  sections: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(['text', 'image', 'video', 'button', 'carousel', 'countdown', 'reviews', 'products', 'testimonials', 'faq']),
      content: z.object({}).passthrough(),
      position: z.number().int().min(0),
      customCSS: z.string().optional(),
      customHTML: z.string().optional(),
    })
  ),
  backgroundImage: z.string().url(),
  isPublic: z.boolean().optional(),
  heroConfig: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
  }).optional(),
  components: z.array(z.string()).optional(),
  testimonials: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      quote: z.string().min(1),
      rating: z.number().min(1).max(5),
      image: z.string().optional(),
    })
  ).optional(),
  assets: z.array(
    z.object({
      name: z.string().min(1),
      url: z.string().url(),
    })
  ).optional(),
});

const createProductSchema = z.object({
  sellerId: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id)),
  name: z.string().min(2),
  description: z.string().min(10),
  price: z.number().min(0),
  countInStock: z.number().min(0),
  category: z.string().min(1),
  brand: z.string().min(1),
  images: z.array(z.string().url()).optional(),
  isPublished: z.boolean().optional(),
  translations: z.array(
    z.object({
      locale: z.string().regex(/^[a-z]{2}$/),
      name: z.string().min(2),
      description: z.string().min(10),
    })
  ).optional(),
  marketplaces: z.array(
    z.object({
      platform: z.string().min(1),
      sku: z.string().min(1),
      externalId: z.string().min(1),
      status: z.enum(['active', 'pending', 'inactive']),
      lastSynced: z.string().datetime(),
    })
  ).optional(),
});

const cache = new LRUCache<string, any>({
  max: 100,
  ttl: 1000 * 60 * 5, // 5 دقايق
});

const tools = [
  {
    function_declarations: [
      {
        name: 'createTemplate',
        description: 'Creates a new template for a seller with detailed configuration.',
        parameters: {
          type: 'object',
          properties: {
            sellerId: { type: 'string', description: 'The ID of the seller creating the template.' },
            name: { type: 'string', description: 'The name of the new template.' },
            theme: { type: 'string', enum: ['light', 'dark'], description: 'Theme of the template.' },
            font: { type: 'string', description: 'Font style for the template.' },
            colors: {
              type: 'object',
              properties: {
                primary: { type: 'string', description: 'Primary color (hex code).' },
                secondary: { type: 'string', description: 'Secondary color (hex code).' },
                background: { type: 'string', description: 'Background color (hex code).' },
              },
              required: ['primary', 'secondary', 'background'],
            },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Section ID.' },
                  type: {
                    type: 'string',
                    enum: ['text', 'image', 'video', 'button', 'carousel', 'countdown', 'reviews', 'products', 'testimonials', 'faq'],
                    description: 'Type of section.',
                  },
                  content: { type: 'object', description: 'Content of the section.' },
                  position: { type: 'number', description: 'Position of the section.' },
                  customCSS: { type: 'string', description: 'Optional custom CSS for the section.' },
                  customHTML: { type: 'string', description: 'Optional custom HTML for the section.' },
                },
                required: ['id', 'type', 'content', 'position'],
              },
            },
            backgroundImage: { type: 'string', description: 'URL of the background image.' },
            isPublic: { type: 'boolean', description: 'Whether the template is public.' },
            heroConfig: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Hero section title.' },
                subtitle: { type: 'string', description: 'Hero section subtitle.' },
              },
            },
            components: { type: 'array', items: { type: 'string' }, description: 'List of components used in the template.' },
            testimonials: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Testimonial ID.' },
                  name: { type: 'string', description: 'Name of the person.' },
                  quote: { type: 'string', description: 'Testimonial quote.' },
                  rating: { type: 'number', description: 'Rating (1-5).' },
                  image: { type: 'string', description: 'Image URL of the person.' },
                },
                required: ['id', 'name', 'quote', 'rating'],
              },
            },
            assets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Asset name.' },
                  url: { type: 'string', description: 'Asset URL.' },
                },
                required: ['name', 'url'],
              },
            },
          },
          required: ['sellerId', 'name', 'theme', 'font', 'colors', 'sections', 'backgroundImage'],
        },
      },
      {
        name: 'updateTemplate',
        description: 'Updates an existing template for a seller with specified fields.',
        parameters: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'The ID of the template to update.' },
            sellerId: { type: 'string', description: 'The ID of the seller owning the template.' },
            name: { type: 'string', description: 'New name for the template (optional).' },
            theme: { type: 'string', enum: ['light', 'dark'], description: 'New theme (optional).' },
            font: { type: 'string', description: 'New font style (optional).' },
            colors: {
              type: 'object',
              properties: {
                primary: { type: 'string', description: 'New primary color (hex code, optional).' },
                secondary: { type: 'string', description: 'New secondary color (hex code, optional).' },
                background: { type: 'string', description: 'New background color (hex code, optional).' },
              },
            },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Section ID.' },
                  type: {
                    type: 'string',
                    enum: ['text', 'image', 'video', 'button', 'carousel', 'countdown', 'reviews', 'products', 'testimonials', 'faq'],
                    description: 'Type of section.',
                  },
                  content: { type: 'object', description: 'Content of the section.' },
                  position: { type: 'number', description: 'Position of the section.' },
                  customCSS: { type: 'string', description: 'Optional custom CSS for the section.' },
                  customHTML: { type: 'string', description: 'Optional custom HTML for the section.' },
                },
                required: ['id', 'type', 'content', 'position'],
              },
            },
            backgroundImage: { type: 'string', description: 'New background image URL (optional).' },
            isPublic: { type: 'boolean', description: 'Whether the template is public (optional).' },
            heroConfig: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'New hero section title (optional).' },
                subtitle: { type: 'string', description: 'New hero section subtitle (optional).' },
              },
            },
            components: { type: 'array', items: { type: 'string' }, description: 'New list of components (optional).' },
            testimonials: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Testimonial ID.' },
                  name: { type: 'string', description: 'Name of the person.' },
                  quote: { type: 'string', description: 'Testimonial quote.' },
                  rating: { type: 'number', description: 'Rating (1-5).' },
                  image: { type: 'string', description: 'Image URL of the person.' },
                },
                required: ['id', 'name', 'quote', 'rating'],
              },
            },
            assets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Asset name.' },
                  url: { type: 'string', description: 'Asset URL.' },
                },
                required: ['name', 'url'],
              },
            },
          },
          required: ['templateId', 'sellerId'],
        },
      },
      {
        name: 'deleteTemplate',
        description: 'Deletes an existing template for a seller.',
        parameters: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'The ID of the template to delete.' },
            sellerId: { type: 'string', description: 'The ID of the seller owning the template.' },
          },
          required: ['templateId', 'sellerId'],
        },
      },
      {
        name: 'listTemplates',
        description: 'Lists all templates for a specific seller.',
        parameters: {
          type: 'object',
          properties: {
            sellerId: { type: 'string', description: 'The ID of the seller whose templates to list.' },
          },
          required: ['sellerId'],
        },
      },
      {
        name: 'createProduct',
        description: 'Creates a new product for a seller.',
        parameters: {
          type: 'object',
          properties: {
            sellerId: { type: 'string', description: 'The ID of the seller creating the product.' },
            name: { type: 'string', description: 'The name of the product.' },
            description: { type: 'string', description: 'Description of the product.' },
            price: { type: 'number', description: 'Price of the product.' },
            countInStock: { type: 'number', description: 'Stock quantity.' },
            images: { type: 'array', items: { type: 'string' }, description: 'URLs of product images.' },
            category: { type: 'string', description: 'Product category.' },
            brand: { type: 'string', description: 'Product brand.' },
            isPublished: { type: 'boolean', description: 'Whether the product is published.' },
            translations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  locale: { type: 'string', description: 'Locale code (e.g., en, ar).' },
                  name: { type: 'string', description: 'Translated product name.' },
                  description: { type: 'string', description: 'Translated product description.' },
                },
                required: ['locale', 'name', 'description'],
              },
            },
            marketplaces: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  platform: { type: 'string', description: 'Marketplace platform.' },
                  sku: { type: 'string', description: 'SKU for the marketplace.' },
                  externalId: { type: 'string', description: 'External ID for the marketplace.' },
                  status: { type: 'string', enum: ['active', 'pending', 'inactive'], description: 'Marketplace status.' },
                  lastSynced: { type: 'string', description: 'Last sync date (ISO format).' },
                },
                required: ['platform', 'sku', 'externalId', 'status', 'lastSynced'],
              },
            },
          },
          required: ['sellerId', 'name', 'description', 'price', 'countInStock', 'category', 'brand'],
        },
      },
      {
        name: 'findTemplateByName',
        description: 'Finds a template ID by name for a seller.',
        parameters: {
          type: 'object',
          properties: {
            sellerId: { type: 'string', description: 'The ID of the seller.' },
            name: { type: 'string', description: 'The name of the template to find.' },
          },
          required: ['sellerId', 'name'],
        },
      },
      {
        name: 'updateSellerSettings',
        description: 'Updates specific settings for a seller.',
        parameters: {
          type: 'object',
          properties: {
            sellerId: { type: 'string', description: 'The ID of the seller.' },
            settings: {
              type: 'object',
              properties: {
                language: { type: 'string', enum: ['en', 'ar', 'fr', 'es', 'de', 'other'], description: 'Preferred language.' },
                notifications: {
                  type: 'object',
                  properties: {
                    email: { type: 'boolean', description: 'Enable email notifications.' },
                    sms: { type: 'boolean', description: 'Enable SMS notifications.' },
                    push: { type: 'boolean', description: 'Enable push notifications.' },
                    orderUpdates: { type: 'boolean', description: 'Enable order update notifications.' },
                    marketingEmails: { type: 'boolean', description: 'Enable marketing emails.' },
                    pointsNotifications: { type: 'boolean', description: 'Enable points notifications.' },
                  },
                },
                display: {
                  type: 'object',
                  properties: {
                    showRating: { type: 'boolean', description: 'Show rating on profile.' },
                    showContactInfo: { type: 'boolean', description: 'Show contact info.' },
                    showMetrics: { type: 'boolean', description: 'Show metrics.' },
                    showPointsBalance: { type: 'boolean', description: 'Show points balance.' },
                  },
                },
              },
            },
          },
          required: ['sellerId', 'settings'],
        },
      },
      {
        name: 'getSellerDetails',
        description: 'Retrieves details about a specific seller from the database.',
        parameters: {
          type: 'object',
          properties: {
            sellerId: { type: 'string', description: 'The ID of the seller to retrieve details for.' },
          },
          required: ['sellerId'],
        },
      },
      {
        name: 'updateOrderStatus',
        description: 'Updates the status of an order for a seller.',
        parameters: {
          type: 'object',
          properties: {
            sellerId: { type: 'string', description: 'The ID of the seller.' },
            orderId: { type: 'string', description: 'The ID of the order to update.' },
            status: {
              type: 'string',
              enum: ['pending_supply', 'processing', 'shipped', 'delivered', 'cancelled'],
              description: 'New status for the order.',
            },
          },
          required: ['sellerId', 'orderId', 'status'],
        },
      },
      {
        name: 'importDropshippingProduct',
        description: 'Imports a dropshipping product for a seller.',
        parameters: {
          type: 'object',
          properties: {
            sellerId: { type: 'string', description: 'The ID of the seller.' },
            sourceId: { type: 'string', description: 'The ID of the product in the source platform.' },
            name: { type: 'string', description: 'Product name.' },
            description: { type: 'string', description: 'Product description.' },
            price: { type: 'number', description: 'Product price.' },
            images: { type: 'array', items: { type: 'string' }, description: 'Product images.' },
            currency: { type: 'string', description: 'Currency of the product.' },
            category: { type: 'string', description: 'Product category.' },
            countInStock: { type: 'number', description: 'Stock quantity.' },
          },
          required: ['sellerId', 'sourceId', 'name', 'price', 'currency', 'category'],
        },
      },
    ],
  },
];

export async function POST(req: Request) {
  const mode = process.env.NODE_ENV === 'development' ? 'sandbox' : 'live';
  const API_KEY = process.env.GOOGLE_API_KEY;

  if (!API_KEY) {
    customLogger.error('GOOGLE_API_KEY is not set', { service: 'chat-gemini' });
    throw new Error('GOOGLE_API_KEY is not set in environment variables');
  }

  const genAI = new GoogleGenerativeAI(API_KEY);

  try {
    const session = await getSession({ req });
    if (!session || !session.user?.id) {
      customLogger.error('Unauthorized access attempt', { service: 'chat-gemini' });
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, history, currentSellerId } = await req.json();

    if (!currentSellerId || !mongoose.Types.ObjectId.isValid(currentSellerId)) {
      customLogger.error('Invalid or missing sellerId', { service: 'chat-gemini', sellerId: currentSellerId });
      return NextResponse.json({ message: 'Invalid or missing sellerId' }, { status: 400 });
    }

    if (session.user.id !== currentSellerId) {
      customLogger.error('Unauthorized: sellerId does not match session', { service: 'chat-gemini', sellerId: currentSellerId });
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase(mode);
    const seller = await Seller.findById(currentSellerId);
    if (!seller) {
      customLogger.error('Seller not found', { service: 'chat-gemini', sellerId: currentSellerId });
      return NextResponse.json({ message: 'Seller not found' }, { status: 404 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      tools: tools,
    });

    const chatHistory = history.map((msg: any) => {
      if (msg.role === 'tool') {
        return {
          functionResponse: {
            name: msg.content.name,
            response: msg.content.response,
          },
        };
      } else if (msg.role === 'assistant' && msg.content.functionCall) {
        return {
          functionCall: {
            name: msg.content.functionCall.name,
            args: msg.content.functionCall.args,
          },
        };
      } else {
        return {
          text: msg.content,
          role: msg.role === 'user' ? 'user' : 'model',
        };
      }
    });

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(prompt);
    const response = result.response;

    const userMsg = { role: 'user' as const, content: prompt, createdAt: new Date() };
    let assistantMsg: any = null;

    if (response.functionCall) {
      const functionCall: FunctionCall = response.functionCall;
      const { name, args } = functionCall;

      if (args.sellerId !== currentSellerId) {
        customLogger.error('Unauthorized: sellerId does not match current user', {
          service: 'chat-gemini',
          sellerId: args.sellerId,
          currentSellerId,
        });
        throw new Error('Unauthorized: sellerId does not match current user');
      }

      let functionResult: any;

      switch (name) {
        case 'createTemplate':
          try {
            createTemplateSchema.parse(args);
            const templateId = nanoid(10);
            const newTemplate = await Template.create({
              templateId,
              sellerId: args.sellerId,
              createdBy: args.sellerId,
              name: args.name,
              theme: args.theme,
              font: args.font,
              colors: args.colors,
              sections: args.sections,
              backgroundImage: args.backgroundImage,
              isPublic: args.isPublic || false,
              heroConfig: args.heroConfig || { title: '', subtitle: '' },
              components: args.components || [],
              testimonials: args.testimonials || [],
              assets: args.assets || [],
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            functionResult = {
              success: true,
              templateId: newTemplate.templateId,
              message: `Template "${args.name}" created successfully`,
              template: {
                id: newTemplate._id,
                templateId: newTemplate.templateId,
                name: newTemplate.name,
                theme: newTemplate.theme,
                sections: newTemplate.sections,
                backgroundImage: newTemplate.backgroundImage,
              },
            };
            customLogger.info('Template created successfully', {
              service: 'chat-gemini',
              templateId: newTemplate.templateId,
              sellerId: args.sellerId,
            });
            assistantMsg = {
              role: 'assistant' as const,
              content: functionResult.message,
              template: functionResult.template,
              createdAt: new Date(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create template';
            customLogger.error('Failed to create template', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
              error: errorMessage,
            });
            functionResult = { success: false, error: errorMessage };
          }
          break;

        case 'updateTemplate':
          try {
            const updatePayload: { [key: string]: any } = { updatedAt: new Date() };
            if (args.name !== undefined) updatePayload.name = args.name;
            if (args.theme !== undefined) updatePayload.theme = args.theme;
            if (args.font !== undefined) updatePayload.font = args.font;
            if (args.colors !== undefined) updatePayload.colors = args.colors;
            if (args.sections !== undefined) updatePayload.sections = args.sections;
            if (args.backgroundImage !== undefined) updatePayload.backgroundImage = args.backgroundImage;
            if (args.isPublic !== undefined) updatePayload.isPublic = args.isPublic;
            if (args.heroConfig !== undefined) updatePayload.heroConfig = args.heroConfig;
            if (args.components !== undefined) updatePayload.components = args.components;
            if (args.testimonials !== undefined) updatePayload.testimonials = args.testimonials;
            if (args.assets !== undefined) updatePayload.assets = args.assets;

            const updatedTemplate = await Template.findOneAndUpdate(
              { templateId: args.templateId, createdBy: args.sellerId },
              { $set: updatePayload },
              { new: true }
            );
            if (!updatedTemplate) {
              throw new Error('Template not found or unauthorized');
            }
            functionResult = {
              success: true,
              templateId: updatedTemplate.templateId,
              message: `Template "${updatedTemplate.name}" updated successfully`,
              template: {
                id: updatedTemplate._id,
                templateId: updatedTemplate.templateId,
                name: updatedTemplate.name,
                theme: updatedTemplate.theme,
                sections: updatedTemplate.sections,
                backgroundImage: updatedTemplate.backgroundImage,
              },
            };
            customLogger.info('Template updated successfully', {
              service: 'chat-gemini',
              templateId: updatedTemplate.templateId,
              sellerId: args.sellerId,
            });
            assistantMsg = {
              role: 'assistant' as const,
              content: functionResult.message,
              template: functionResult.template,
              createdAt: new Date(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update template';
            customLogger.error('Failed to update template', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
              templateId: args.templateId,
              error: errorMessage,
            });
            functionResult = { success: false, error: errorMessage };
          }
          break;

        case 'deleteTemplate':
          try {
            const deletedTemplate = await Template.findOneAndDelete({
              templateId: args.templateId,
              createdBy: args.sellerId,
            });
            if (!deletedTemplate) {
              throw new Error('Template not found or unauthorized');
            }
            functionResult = {
              success: true,
              message: `Template "${deletedTemplate.name}" deleted successfully`,
            };
            customLogger.info('Template deleted successfully', {
              service: 'chat-gemini',
              templateId: args.templateId,
              sellerId: args.sellerId,
            });
            assistantMsg = {
              role: 'assistant' as const,
              content: functionResult.message,
              createdAt: new Date(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete template';
            customLogger.error('Failed to delete template', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
              templateId: args.templateId,
              error: errorMessage,
            });
            functionResult = { success: false, error: errorMessage };
          }
          break;

        case 'listTemplates':
          try {
            const cacheKey = `templates:${args.sellerId}`;
            let functionResult = cache.get(cacheKey);
            if (!functionResult) {
              const templates = await Template.find({ createdBy: args.sellerId }).select(
                'templateId name theme font colors sections backgroundImage isPublic heroConfig components testimonials assets createdAt'
              );
              functionResult = {
                success: true,
                templates: templates.map((t) => ({
                  id: t._id,
                  templateId: t.templateId,
                  name: t.name,
                  theme: t.theme,
                  sections: t.sections,
                  backgroundImage: t.backgroundImage,
                  isPublic: t.isPublic,
                  createdAt: t.createdAt,
                })),
              };
              cache.set(cacheKey, functionResult);
            }
            customLogger.info('Templates listed successfully', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
              count: functionResult.templates.length,
            });
            assistantMsg = {
              role: 'assistant' as const,
              content: `Found ${functionResult.templates.length} templates`,
              createdAt: new Date(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to list templates';
            customLogger.error('Failed to list templates', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
              error: errorMessage,
            });
            functionResult = { success: false, error: errorMessage };
          }
          break;

        case 'createProduct':
          try {
            createProductSchema.parse(args);
            const slug = `${args.name.toLowerCase().replace(/\s+/g, '-')}-${nanoid(6)}`;
            const newProduct = await Product.create({
              sellerId: args.sellerId,
              name: args.name,
              slug,
              description: args.description,
              pricing: {
                basePrice: args.price,
                finalPrice: args.price,
                markup: 0,
                profit: 0,
                commission: 0,
                currency: 'USD',
              },
              countInStock: args.countInStock,
              images: args.images || [],
              category: args.category,
              brand: args.brand || '',
              isPublished: args.isPublished || false,
              translations: args.translations || [],
              marketplaces: args.marketplaces || [],
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            functionResult = {
              success: true,
              productId: newProduct._id,
              message: `Product "${args.name}" created successfully`,
              product: {
                id: newProduct._id,
                name: newProduct.name,
                description: newProduct.description,
                price: newProduct.pricing.finalPrice,
                images: newProduct.images,
              },
            };
            customLogger.info('Product created successfully', {
              service: 'chat-gemini',
              productId: newProduct._id,
              sellerId: args.sellerId,
            });
            assistantMsg = {
              role: 'assistant' as const,
              content: functionResult.message,
              product: functionResult.product,
              createdAt: new Date(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create product';
            customLogger.error('Failed to create product', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
              error: errorMessage,
            });
            functionResult = { success: false, error: errorMessage };
          }
          break;

        case 'findTemplateByName':
          try {
            const template = await Template.findOne({ createdBy: args.sellerId, name: args.name }).select('templateId');
            if (!template) {
              throw new Error('Template not found');
            }
            functionResult = {
              success: true,
              templateId: template.templateId,
              message: `Template "${args.name}" found with ID ${template.templateId}`,
            };
            customLogger.info('Template found successfully', {
              service: 'chat-gemini',
              templateId: template.templateId,
              sellerId: args.sellerId,
            });
            assistantMsg = {
              role: 'assistant' as const,
              content: functionResult.message,
              createdAt: new Date(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to find template';
            customLogger.error('Failed to find template', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
              name: args.name,
              error: errorMessage,
            });
            functionResult = { success: false, error: errorMessage };
          }
          break;

        case 'updateSellerSettings':
          try {
            const updatePayload: { [key: string]: any } = {};
            if (args.settings.language !== undefined) updatePayload['settings.language'] = args.settings.language;
            if (args.settings.notifications) {
              if (args.settings.notifications.email !== undefined) updatePayload['settings.notifications.email'] = args.settings.notifications.email;
              if (args.settings.notifications.sms !== undefined) updatePayload['settings.notifications.sms'] = args.settings.notifications.sms;
              if (args.settings.notifications.push !== undefined) updatePayload['settings.notifications.push'] = args.settings.notifications.push;
              if (args.settings.notifications.orderUpdates !== undefined) updatePayload['settings.notifications.orderUpdates'] = args.settings.notifications.orderUpdates;
              if (args.settings.notifications.marketingEmails !== undefined) updatePayload['settings.notifications.marketingEmails'] = args.settings.notifications.marketingEmails;
              if (args.settings.notifications.pointsNotifications !== undefined) updatePayload['settings.notifications.pointsNotifications'] = args.settings.notifications.pointsNotifications;
            }
            if (args.settings.display) {
              if (args.settings.display.showRating !== undefined) updatePayload['settings.display.showRating'] = args.settings.display.showRating;
              if (args.settings.display.showContactInfo !== undefined) updatePayload['settings.display.showContactInfo'] = args.settings.display.showContactInfo;
              if (args.settings.display.showMetrics !== undefined) updatePayload['settings.display.showMetrics'] = args.settings.display.showMetrics;
              if (args.settings.display.showPointsBalance !== undefined) updatePayload['settings.display.showPointsBalance'] = args.settings.display.showPointsBalance;
            }

            const updatedSeller = await Seller.findByIdAndUpdate(
              args.sellerId,
              { $set: updatePayload },
              { new: true }
            );
            if (!updatedSeller) {
              throw new Error('Seller not found');
            }
            functionResult = {
              success: true,
              message: 'Settings updated successfully',
            };
            customLogger.info('Seller settings updated successfully', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
            });
            assistantMsg = {
              role: 'assistant' as const,
              content: functionResult.message,
              createdAt: new Date(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update settings';
            customLogger.error('Failed to update seller settings', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
              error: errorMessage,
            });
            functionResult = { success: false, error: errorMessage };
          }
          break;

        case 'getSellerDetails':
          try {
            const sellerDetails = await Seller.findById(args.sellerId).select(
              'businessName email phone address settings metrics'
            );
            if (!sellerDetails) {
              throw new Error('Seller not found');
            }
            functionResult = {
              success: true,
              seller: {
                businessName: sellerDetails.businessName,
                email: sellerDetails.email,
                phone: sellerDetails.phone,
                address: sellerDetails.address,
                settings: sellerDetails.settings,
                metrics: sellerDetails.metrics,
              },
            };
            customLogger.info('Seller details retrieved successfully', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
            });
            assistantMsg = {
              role: 'assistant' as const,
              content: `Seller details: ${sellerDetails.businessName}`,
              createdAt: new Date(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve seller details';
            customLogger.error('Failed to retrieve seller details', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
              error: errorMessage,
            });
            functionResult = { success: false, error: errorMessage };
          }
          break;

        case 'updateOrderStatus':
          try {
            const Order = mongoose.model('Order');
            const updatedOrder = await Order.findOneAndUpdate(
              { _id: args.orderId, sellerId: args.sellerId },
              { status: args.status, updatedAt: new Date() },
              { new: true }
            );
            if (!updatedOrder) {
              throw new Error('Order not found or unauthorized');
            }
            functionResult = {
              success: true,
              orderId: updatedOrder._id,
              message: `Order ${args.orderId} status updated to ${args.status}`,
            };
            customLogger.info('Order status updated successfully', {
              service: 'chat-gemini',
              orderId: args.orderId,
              sellerId: args.sellerId,
            });
            assistantMsg = {
              role: 'assistant' as const,
              content: functionResult.message,
              createdAt: new Date(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update order status';
            customLogger.error('Failed to update order status', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
              orderId: args.orderId,
              error: errorMessage,
            });
            functionResult = { success: false, error: errorMessage };
          }
          break;

        case 'importDropshippingProduct':
          try {
            const slug = `${args.name.toLowerCase().replace(/\s+/g, '-')}-${nanoid(6)}`;
            const newProduct = await Product.create({
              sellerId: args.sellerId,
              name: args.name,
              slug,
              description: args.description,
              pricing: {
                basePrice: args.price,
                finalPrice: args.price,
                markup: 0,
                profit: 0,
                commission: 0,
                currency: args.currency || 'USD',
              },
              countInStock: args.countInStock,
              images: args.images || [],
              category: args.category,
              brand: '',
              isPublished: false,
              translations: [],
              marketplaces: [
                {
                  platform: 'dropshipping',
                  sku: args.sourceId,
                  externalId: args.sourceId,
                  status: 'pending',
                  lastSynced: new Date(),
                },
              ],
              source: {
                providerId: args.sellerId,
                productId: args.sourceId,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            functionResult = {
              success: true,
              productId: newProduct._id,
              message: `Dropshipping product "${args.name}" imported successfully`,
              product: {
                id: newProduct._id,
                name: newProduct.name,
                description: newProduct.description,
                price: newProduct.pricing.finalPrice,
                images: newProduct.images,
              },
            };
            customLogger.info('Dropshipping product imported successfully', {
              service: 'chat-gemini',
              productId: newProduct._id,
              sellerId: args.sellerId,
            });
            assistantMsg = {
              role: 'assistant' as const,
              content: functionResult.message,
              product: functionResult.product,
              createdAt: new Date(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to import dropshipping product';
            customLogger.error('Failed to import dropshipping product', {
              service: 'chat-gemini',
              sellerId: args.sellerId,
              error: errorMessage,
            });
            functionResult = { success: false, error: errorMessage };
          }
          break;

        default:
          const errorMessage = `Unknown function call: ${name}`;
          customLogger.error(errorMessage, { service: 'chat-gemini', functionName: name });
          throw new Error(errorMessage);
      }

      const toolResponse: FunctionResponse = {
        name,
        response: { result: functionResult },
      };

      const followUpResult = await chat.sendMessage([toolResponse]);
      const followUpResponseText = followUpResult.response.text();
      assistantMsg = assistantMsg || {
        role: 'assistant' as const,
        content: followUpResponseText,
        createdAt: new Date(),
      };

      await ChatHistory.findOneAndUpdate(
        { sellerId: currentSellerId },
        {
          $push: { messages: { $each: [userMsg, assistantMsg] } },
          updatedAt: new Date(),
        },
        { upsert: true }
      );

      return NextResponse.json(
        {
          response: followUpResponseText,
          toolExecuted: true,
          template: functionResult.template,
          product: functionResult.product,
        },
        { status: 200 }
      );
    } else {
      let templateData: any = null;
      let productData: any = null;
      try {
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedData = JSON5.parse(jsonMatch[0]);
          if (
            parsedData.name &&
            parsedData.theme &&
            Array.isArray(parsedData.sections) &&
            parsedData.sections.every(
              (section: any) =>
                section.id &&
                section.type &&
                section.content &&
                typeof section.position === 'number'
            )
          ) {
            createTemplateSchema.parse(parsedData);
            const templateId = nanoid(10);
            const newTemplate = await Template.create({
              templateId,
              sellerId: currentSellerId,
              createdBy: currentSellerId,
              name: parsedData.name,
              theme: parsedData.theme || 'light',
              font: parsedData.font || 'Arial',
              colors: parsedData.colors || {
                primary: '#000000',
                secondary: '#ffffff',
                background: '#f0f0f0',
              },
              sections: parsedData.sections || [],
              backgroundImage: parsedData.backgroundImage || '',
              isPublic: parsedData.isPublic || false,
              heroConfig: parsedData.heroConfig || { title: '', subtitle: '' },
              components: parsedData.components || [],
              testimonials: parsedData.testimonials || [],
              assets: parsedData.assets || [],
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            templateData = {
              id: newTemplate._id,
              templateId: newTemplate.templateId,
              name: newTemplate.name,
              theme: newTemplate.theme,
              sections: newTemplate.sections,
              backgroundImage: newTemplate.backgroundImage,
            };
            customLogger.info('Template created from text response', {
              service: 'chat-gemini',
              templateId: newTemplate.templateId,
              sellerId: currentSellerId,
            });
            assistantMsg = {
              role: 'assistant' as const,
              content: `Template "${newTemplate.name}" created from response and saved successfully!`,
              template: templateData,
              createdAt: new Date(),
            };
          } else if (
            parsedData.name &&
            parsedData.description &&
            parsedData.price &&
            parsedData.category
          ) {
            createProductSchema.parse(parsedData);
            const slug = `${parsedData.name.toLowerCase().replace(/\s+/g, '-')}-${nanoid(6)}`;
            const newProduct = await Product.create({
              sellerId: currentSellerId,
              name: parsedData.name,
              slug,
              description: parsedData.description,
              pricing: {
                basePrice: parsedData.price,
                finalPrice: parsedData.price,
                markup: 0,
                profit: 0,
                commission: 0,
                currency: parsedData.currency || 'USD',
              },
              countInStock: parsedData.countInStock || 0,
              images: parsedData.images || [],
              category: parsedData.category,
              brand: parsedData.brand || '',
              isPublished: parsedData.isPublished || false,
              translations: parsedData.translations || [],
              marketplaces: parsedData.marketplaces || [],
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            productData = {
              id: newProduct._id,
              name: newProduct.name,
              description: newProduct.description,
              price: newProduct.pricing.finalPrice,
              images: newProduct.images,
            };
            customLogger.info('Product created from text response', {
              service: 'chat-gemini',
              productId: newProduct._id,
              sellerId: currentSellerId,
            });
            assistantMsg = {
              role: 'assistant' as const,
              content: `Product "${newProduct.name}" created from response and saved successfully!`,
              product: productData,
              createdAt: new Date(),
            };
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to parse template or product from response';
        customLogger.error(errorMessage, { service: 'chat-gemini', text: response.text() });
        assistantMsg = {
          role: 'assistant' as const,
          content: response.text(),
          createdAt: new Date(),
        };
      }

      await ChatHistory.findOneAndUpdate(
        { sellerId: currentSellerId },
        {
          $push: { messages: { $each: [userMsg, assistantMsg || { role: 'assistant', content: response.text(), createdAt: new Date() }] } },
          updatedAt: new Date(),
        },
        { upsert: true }
      );

      return NextResponse.json(
        {
          response: assistantMsg ? assistantMsg.content : response.text(),
          toolExecuted: !!templateData || !!productData,
          template: templateData,
          product: productData,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    customLogger.error('API Error', { service: 'chat-gemini', error: errorMessage });
    return NextResponse.json(
      { message: 'Internal Server Error', error: errorMessage },
      { status: 500 }
    );
  }
}