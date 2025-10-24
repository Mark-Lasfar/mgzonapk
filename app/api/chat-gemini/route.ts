// app/api/chat-gemini/route.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server'; // لو بتستخدم App Router

// جيب مفتاح الـ API من الـ environment variables
const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  throw new Error('GOOGLE_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(API_KEY);

export async function POST(req: Request) {
  try {
    const { prompt, history } = await req.json(); // استقبال الرسالة وتاريخ المحادثة

    // اختيار نموذج Gemini (مثلاً gemini-1.5-flash أو gemini-pro)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // تحويل تاريخ المحادثة إلى صيغة Gemini
    const chatHistory = history.map((msg: any) => ({
      role: msg.role,
      parts: msg.parts.map((part: any) => ({ text: part.text })),
    }));

    // بدء محادثة مع النموذج
    const chat = model.startChat({
      history: chatHistory,
    });

    // إرسال الرسالة الجديدة
    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();

    // إرجاع الرد كـ JSON
    return NextResponse.json({ response: responseText }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        message: 'Internal Server Error',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}