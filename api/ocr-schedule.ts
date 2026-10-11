import { GoogleGenAI, Type } from '@google/genai';

const OCR_MODEL_PRIMARY = 'gemini-3.6-flash';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      endpoint: '/api/ocr-schedule',
      status: 'READY',
      message: 'OCR Schedule API is ready. Send POST with { images: [...] }'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { code: 405, status: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }
    });
  }

  try {
    let parsedBody = req.body;
    if (typeof parsedBody === 'string') {
      try {
        parsedBody = JSON.parse(parsedBody);
      } catch (parseErr) {
        console.warn('Could not parse string req.body as JSON:', parseErr);
      }
    }

    const { images, image, model } = parsedBody || {};
    let requestedModel = model || OCR_MODEL_PRIMARY;

    if (requestedModel === 'gemini-2.5-flash') {
      requestedModel = OCR_MODEL_PRIMARY;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length === 0) {
      return res.status(401).json({
        error: {
          code: 401,
          status: 'UNAUTHORIZED',
          message: 'Model OCR chưa được cấu hình. Vui lòng thiết lập API key GEMINI_API_KEY.'
        }
      });
    }

    const imageList = Array.isArray(images) ? images : (image ? [image] : []);

    if (imageList.length === 0) {
      return res.status(400).json({ error: 'Vui lòng cung cấp ít nhất một hình ảnh lịch công tác.' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const parts: any[] = [];

    for (const img of imageList) {
      let base64Data = typeof img === 'string' ? img : (img.data || img);
      let mimeType = (typeof img === 'object' && img.mimeType) ? img.mimeType : 'image/jpeg';

      if (typeof base64Data === 'string' && base64Data.includes(';base64,')) {
        const split = base64Data.split(';base64,');
        const matchMime = split[0].match(/data:(.*?);/);
        if (matchMime) mimeType = matchMime[1];
        base64Data = split[1];
      }

      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    parts.push({
      text: `Hãy đọc chính xác nội dung lịch công tác trong ảnh.
Đây là bảng lịch công tác của Trường THPT Sơn Lương.
Hãy nhận diện:
- tiêu đề
- tuần
- khoảng thời gian
- thứ
- ngày
- thời gian
- nội dung công việc
- địa điểm
- người thực hiện/phụ trách
- ghi chú
Giữ nguyên thứ tự các dòng trong bảng.
Không tự suy đoán nội dung bị mờ hoặc không nhìn thấy.
Nếu một ô không đọc được, để chuỗi rỗng.
Chỉ trả về JSON, không thêm markdown.`
    });

    const response = await ai.models.generateContent({
      model: requestedModel,
      contents: { parts },
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Tiêu đề lịch công tác' },
            week: { type: Type.STRING, description: 'Số tuần' },
            date_range: { type: Type.STRING, description: 'Khoảng thời gian' },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.STRING, description: 'Thứ trong tuần' },
                  date: { type: Type.STRING, description: 'Ngày' },
                  time: { type: Type.STRING, description: 'Thời gian / buổi' },
                  content: { type: Type.STRING, description: 'Nội dung công việc cụ thể' },
                  location: { type: Type.STRING, description: 'Địa điểm' },
                  person_in_charge: { type: Type.STRING, description: 'Người thực hiện' },
                  note: { type: Type.STRING, description: 'Ghi chú' }
                },
                required: ['day', 'content']
              }
            }
          },
          required: ['title', 'items']
        }
      }
    });

    const rawText = response.text || '{}';
    let cleanText = rawText.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    const parsedData = JSON.parse(cleanText);
    return res.status(200).json({ success: true, data: parsedData });
  } catch (err: any) {
    console.error('[API OCR-SCHEDULE] Error:', err);
    return res.status(500).json({
      error: {
        code: 500,
        status: 'INTERNAL_ERROR',
        message: err.message || 'Không thể nhận diện hình ảnh.'
      }
    });
  }
}
