import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import MiniSearch from 'minisearch';
import { callGptOss } from '@/lib/utils/hfClient';
import { randomUUID } from 'node:crypto';
import { getMongoClient } from '@/lib/db';
import { ApiResponse } from '@/lib/types';

// تحميل البيانات
const trainingData = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'chatbot/mgzon_oauth_training_data.json'),
    'utf-8'
  )
);

// فهرس الأسئلة الشائعة
const questionSearch = new MiniSearch({
  fields: ['question'],
  storeFields: ['question', 'answer', 'explanation', 'instructions', 'section'],
  searchOptions: { fuzzy: 0.2, prefix: true },
});
questionSearch.addAll(trainingData);

export async function POST(request: NextRequest) {
  // تحميل الترجمات
  const translations = {
    ar: JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages/ar.json'), 'utf-8')),
    en: JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages/en.json'), 'utf-8')),
  };

  // قراءة الجسم مرة واحدة
  const body = await request.json();
  const locale = body.locale ?? 'en';
  const question = body.question?.trim();

  // استخدام الترجمات بنطاق Chatbote
  const t = translations[locale].Chatbote;

  // التحقق من وجود سؤال
  if (!question) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        answer: t.missingQuestion,
        metadata: { requestId: randomUUID(), timestamp: new Date().toISOString() },
      },
      { status: 400 }
    );
  }

  const requestId = randomUUID();

  try {
    // ---------- 1️⃣ البحث في trainingData ----------
    const searchResults = questionSearch.search(question, { fields: ['question'] });
    if (searchResults.length) {
      const top = searchResults[0];
      return NextResponse.json<ApiResponse>({
        success: true,
        answer: top.answer,
        explanation: top.explanation,
        instructions: top.instructions,
        section: top.section,
        metadata: { requestId, timestamp: new Date().toISOString() },
      });
    }

    // ---------- 2️⃣ البحث في منتجات MongoDB ----------
    if (question.toLowerCase().includes('product') || question.includes('منتج')) {
      const client = await getMongoClient();
      const db = client.db('mgzon');
      const productsCollection = db.collection('products');

      // بناء فهرس المنتجات
      const productSearch = new MiniSearch({
        fields: ['name', 'description', 'category'],
        storeFields: ['name', 'description', 'category', 'price', 'countInStock'],
        searchOptions: { fuzzy: 0.2, prefix: true },
      });

      const products = await productsCollection.find({}).toArray();
      productSearch.addAll(products);

      const productResults = productSearch.search(question);
      if (productResults.length) {
        return NextResponse.json<ApiResponse>({
          success: true,
          answer: t.foundProducts.replace('{count}', productResults.length.toString()),
          products: productResults.map(p => ({
            name: p.name,
            description: p.description,
            price: p.price,
            category: p.category,
            stock: p.countInStock,
            currency: p.currency || 'USD', // إضافة currency افتراضي لضمان التوافق
          })),
          instructions: t.refineSearch,
          metadata: { requestId, timestamp: new Date().toISOString() },
        });
      }
    }

    // ---------- 3️⃣ البحث في وثائق OAuth ----------
    const docsKeys = Object.keys(translations[locale].Chatbote.oauth);
    const relevantDocs = docsKeys.filter(k =>
      question.toLowerCase().includes(k.split('.')[1])
    );
    if (relevantDocs.length) {
      const answer = relevantDocs
        .map(k => translations[locale].Chatbote.oauth[k])
        .join('\n');
      return NextResponse.json<ApiResponse>({
        success: true,
        answer,
        instructions: t.oauthDocsInstructions,
        metadata: { requestId, timestamp: new Date().toISOString() },
      });
    }

    // ---------- 4️⃣ استدعاء نموذج GPT‑OSS ----------
    const generated = await callGptOss(question);
    return NextResponse.json<ApiResponse>({
      success: true,
      answer: generated,
      instructions: t.gptOssInstructions,
      metadata: { requestId, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : t.unknownError;
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        answer: t.requestProcessingError,
        error: msg,
        metadata: { requestId, timestamp: new Date().toISOString() },
      },
      { status: 500 }
    );
  }
}