import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const isConfigured = !!apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 0;
  const prefix = isConfigured ? apiKey.substring(0, 6) : 'None';
  const model = 'gemini-3.6-flash';

  if (!isConfigured) {
    return res.status(200).json({
      success: true,
      apiKeyConfigured: false,
      apiKeyPrefix: 'None',
      modelUsed: model,
      apiConnection: false,
      errorMessage: 'Chưa cấu hình API key. Vui lòng thiết lập biến GEMINI_API_KEY trong biến môi trường.'
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const response = await ai.models.generateContent({
      model,
      contents: 'Trả lời OK nếu model đang hoạt động.',
    });

    const responseText = response.text || '';
    return res.status(200).json({
      success: true,
      apiKeyConfigured: true,
      apiKeyPrefix: prefix + '...',
      modelUsed: model,
      apiConnection: responseText.includes('OK') || responseText.length > 0,
      responseSample: responseText.trim(),
      errorMessage: null
    });
  } catch (err: any) {
    console.error('OCR Connection Check Failed:', err);
    return res.status(200).json({
      success: true,
      apiKeyConfigured: true,
      apiKeyPrefix: prefix + '...',
      modelUsed: model,
      apiConnection: false,
      errorMessage: err.message || String(err)
    });
  }
}
