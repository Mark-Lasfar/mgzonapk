// import fetch from 'node-fetch';

import fetch, { Response as FetchResponse } from 'node-fetch';


const HF_ENDPOINT =
  'https://mgzon-mgzon.hf.space';

const HF_TOKEN = process.env.HF_TOKEN;

interface HFResponse {
  data: string[];
}

/**
 *
 * @param question النص الذي تريد إرساله للنموذج
 * @returns النص المستجيب من النموذج
 * @throws إذا فشل الاتصال أو كان الرد غير ناجح
 */
export async function callGptOss(question: string): Promise<string> {
  if (!HF_TOKEN) {
    throw new Error('HF_TOKEN غير موجود في المتغيّر البيئي.');
  }

  const body = JSON.stringify({ data: [question] });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${HF_TOKEN}`,
  };

  // إلغاء الطلب بعد 30 ثانية (يمكن تعديل الوقت حسب الحاجة)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let resp: FetchResponse;

  try {
    resp = await fetch(HF_ENDPOINT, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    let details = '';
    try {
      const errJson = await resp.json();
      details = JSON.stringify(errJson);
    } catch {
      details = await resp.text();
    }
    throw new Error(`HF API error ${resp.status}: ${details}`);
  }

  const json = (await resp.json()) as HFResponse;
  return json.data[0];
}