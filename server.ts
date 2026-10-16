import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware for JSON body parser with increased limit for base64 images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Enable CORS middleware for all incoming requests (prevent "Failed to fetch" on preflights or cross-origin)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  const OCR_MODEL_PRIMARY = "gemini-3.6-flash";
  const OCR_MODEL_FALLBACK = "gemini-3.8-flash";

  // Validate function (Requirement 4)
  function validateOCRConfig() {
    const apiKey = process.env.GEMINI_API_KEY;
    const isConfigured = !!apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 0;
    const prefix = isConfigured ? apiKey!.substring(0, 6) : 'None';
    
    console.log('[OCR CONFIG] API key:', isConfigured ? 'PRESENT' : 'MISSING');
    console.log('[OCR CONFIG] Primary Model:', OCR_MODEL_PRIMARY);
    console.log('[OCR CONFIG] Fallback Model:', OCR_MODEL_FALLBACK);
    console.log('[OCR CONFIG] Endpoint: /api/ocr-schedule');
    console.log('[OCR CONFIG] Ready:', isConfigured ? 'TRUE' : 'FALSE');
    
    return {
      isConfigured,
      prefix,
      model: OCR_MODEL_PRIMARY,
      fallback: OCR_MODEL_FALLBACK,
      endpoint: '/api/ocr-schedule'
    };
  }

  // API Endpoint to check OCR config and lightweight text check (Requirement 10 & 17)
  app.get('/api/ocr-status', async (req, res) => {
    const config = validateOCRConfig();
    if (!config.isConfigured) {
      return res.json({
        success: true,
        apiKeyConfigured: false,
        apiKeyPrefix: 'None',
        modelUsed: config.model,
        apiConnection: false,
        errorMessage: 'Chưa cấu hình API key. Vui lòng thiết lập biến GEMINI_API_KEY trong Secrets.'
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      // Simple test request to verify connection (Requirement 10)
      const response = await ai.models.generateContent({
        model: config.model,
        contents: "Trả lời OK nếu model đang hoạt động.",
      });

      const responseText = response.text || '';
      const connectionSuccessful = responseText.includes('OK') || responseText.length > 0;

      return res.json({
        success: true,
        apiKeyConfigured: true,
        apiKeyPrefix: config.prefix + '...',
        modelUsed: config.model,
        apiConnection: connectionSuccessful,
        responseSample: responseText.trim(),
        errorMessage: null
      });
    } catch (err: any) {
      console.error('OCR Connection Check Failed:', err);
      return res.json({
        success: true,
        apiKeyConfigured: true,
        apiKeyPrefix: config.prefix + '...',
        modelUsed: config.model,
        apiConnection: false,
        errorMessage: err.message || String(err)
      });
    }
  });

  // Ensure public/uploads directory exists
  const uploadDir = path.join(__dirname, 'public/uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Multer configuration using memory storage (safer in serverless, containers, and cloud)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
  });

  // Serve the uploads directory statically
  app.use('/uploads', express.static(uploadDir));

  // Shared upload handler for /api/upload-image and /api/upload
  const handleFileUploadRequest = (req: any, res: any) => {
    try {
      const files = req.files as Express.Multer.File[];
      const file = (files && files.length > 0 ? files[0] : req.file) as Express.Multer.File | undefined;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'Vui lòng cung cấp tệp tin tải lên (trong trường "image", "file" hoặc "document").'
        });
      }

      const mimeType = file.mimetype || 'application/octet-stream';
      const base64Data = file.buffer.toString('base64');
      const base64Url = `data:${mimeType};base64,${base64Data}`;
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      const safeOrigName = file.originalname ? file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_') : 'file';
      const filename = `upload-${uniqueSuffix}-${safeOrigName}`;

      // Optionally try saving to uploads folder if accessible
      let diskUrl = base64Url;
      try {
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, file.buffer);
        if (fs.existsSync(filePath)) {
          diskUrl = `/uploads/${filename}`;
        }
      } catch (diskErr) {
        // Ephemeral or read-only filesystem; base64Url works as reliable fallback
        console.warn('Could not write file to disk, using data URL fallback:', diskErr);
      }

      return res.status(200).json({
        success: true,
        url: base64Url,
        diskUrl: diskUrl,
        filename: filename,
        originalName: file.originalname || filename,
        size: file.size,
        mimeType: mimeType,
        base64: base64Url
      });
    } catch (innerErr: any) {
      console.error('Error handling upload payload:', innerErr);
      return res.status(500).json({
        success: false,
        error: innerErr.message || 'Lỗi xử lý tệp tin trên máy chủ.'
      });
    }
  };

  const uploadErrorHandler = (err: any, req: any, res: any, next: any) => {
    console.error('Multer upload middleware error handler caught:', err);
    const isSizeError = err.code === 'LIMIT_FILE_SIZE' || (err.message && err.message.includes('large'));
    return res.status(isSizeError ? 413 : 400).json({
      success: false,
      error: isSizeError ? 'Dung lượng tệp vượt quá giới hạn cho phép (25MB).' : (err.message || 'Lỗi tải tệp tin lên.')
    });
  };

  // GET health checks for upload endpoints (prevent 404 on browser navigation / GET checks)
  app.get(['/api/upload-image', '/api/upload', '/api/upload-file'], (req, res) => {
    res.json({
      success: true,
      status: 'READY',
      endpoint: req.path,
      message: 'Upload API is operational. Send a POST request with multipart/form-data.'
    });
  });

  // Endpoints to handle Image & Document Upload
  app.post('/api/upload-image', upload.any(), handleFileUploadRequest, uploadErrorHandler);
  app.post('/api/upload', upload.any(), handleFileUploadRequest, uploadErrorHandler);
  app.post('/api/upload-file', upload.any(), handleFileUploadRequest, uploadErrorHandler);

  // API Endpoint for OCR / AI Parsing of Schedule Images
  app.post('/api/ocr-schedule', async (req, res) => {
    try {
      const { images, model } = req.body; // Array of { data: string (base64), mimeType: string }

      let userRequestedModel = model;
      if (userRequestedModel === 'gemini-2.5-flash') {
        userRequestedModel = OCR_MODEL_PRIMARY;
      }

      // Candidate models for automatic cascading fallback to prevent 503/429
      const candidateModels = [
        userRequestedModel,
        OCR_MODEL_PRIMARY,
        OCR_MODEL_FALLBACK,
        'gemini-3.1-flash-lite',
        'gemini-flash-latest'
      ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

      console.log('--------------------------');
      console.log('OCR ENDPOINT: /api/ocr-schedule');
      console.log('CANDIDATE MODELS:', candidateModels.join(' -> '));
      console.log('--------------------------');

      // Check API Key existence and validation
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length === 0) {
        return res.status(401).json({ 
          error: {
            code: 401,
            status: "UNAUTHORIZED",
            message: "Model OCR chưa được cấu hình. Vui lòng thiết lập API key trong Secrets."
          }
        });
      }

      if (!images || !Array.isArray(images) || images.length === 0) {
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

      // Add each image part
      for (const img of images) {
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

      // Specialized Prompt for Vietnamese High School Weekly Schedule (THPT Sơn Lương)
      parts.push({
        text: `Hãy đọc chính xác nội dung lịch công tác trong ảnh của Trường THPT Sơn Lương.
Đọc bảng lịch tuần gồm các cột:
1. Thứ/ Ngày tháng (Thứ 2 đến Chủ nhật, ngày/tháng)
2. BUỔI SÁNG (Các công việc buổi sáng)
3. BUỔI CHIỀU (Các công việc buổi chiều)
4. Trực LĐ (Người trực lãnh đạo: Ông Sáng, Ông Hòa, Ông Hùng...)

Hãy nhận diện đầy đủ:
- Tiêu đề (Ví dụ: LỊCH CÔNG TÁC TUẦN 6)
- Số tuần (Ví dụ: 6)
- Khoảng thời gian (Ví dụ: 12/10 đến 16/10)
- Lớp trực tuần (Ví dụ: 12G từ phần 'Trực tuần: 12G')
- Thời gian làm việc (từ phần Lưu ý cuối trang)
- Người ký / Hiệu trưởng (ở cuối văn bản)
- Nơi nhận (ở góc dưới bên trái)
- Nhận diện chữ màu đỏ hoặc ô được tô nổi bật (is_highlight = true).
- Giữ nguyên các dòng nội dung công việc buổi sáng và buổi chiều.
- Cột Trực LĐ ghi đúng tên người trực lãnh đạo vào 'duty_leader'. Không gộp tên người trực lãnh đạo vào nội dung công việc.

Chỉ trả về JSON theo schema.`
      });

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Tiêu đề lịch công tác (ví dụ: LỊCH CÔNG TÁC TUẦN 6)" },
          week: { type: Type.STRING, description: "Số tuần (ví dụ: '6')" },
          week_number: { type: Type.STRING, description: "Số tuần (ví dụ: '6')" },
          date_range: { type: Type.STRING, description: "Khoảng thời gian (ví dụ: '12/10 đến 16/10')" },
          duty_week: { type: Type.STRING, description: "Lớp trực tuần (ví dụ: '12G')" },
          working_time: { type: Type.STRING, description: "Thời gian làm việc theo phần Lưu ý cuối trang" },
          principal_name: { type: Type.STRING, description: "Họ tên Hiệu trưởng ký tên ở cuối trang" },
          recipients: { type: Type.STRING, description: "Nơi nhận cuối trang" },
          days: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day_of_week: { type: Type.STRING, description: "Thứ trong tuần (Thứ 2, Thứ 3, Thứ 4, Thứ 5, Thứ 6, Thứ 7, Chủ nhật)" },
                date: { type: Type.STRING, description: "Ngày tháng (ví dụ: '12/10')" },
                morning_events: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING, description: "Nội dung công việc buổi sáng" },
                      is_highlight: { type: Type.BOOLEAN, description: "true nếu chữ màu đỏ hoặc ô được tô màu nổi bật" }
                    },
                    required: ["text"]
                  }
                },
                afternoon_events: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING, description: "Nội dung công việc buổi chiều" },
                      is_highlight: { type: Type.BOOLEAN, description: "true nếu chữ màu đỏ hoặc ô được tô màu nổi bật" }
                    },
                    required: ["text"]
                  }
                },
                duty_leader: { type: Type.STRING, description: "Người trực lãnh đạo từ cột Trực LĐ (ví dụ: Ông Sáng, Ông Hòa, Ông Hùng)" }
              },
              required: ["day_of_week", "date", "morning_events", "afternoon_events"]
            }
          },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING, description: "Thứ trong tuần" },
                date: { type: Type.STRING, description: "Ngày" },
                time: { type: Type.STRING, description: "Buổi (Sáng, Chiều)" },
                content: { type: Type.STRING, description: "Nội dung" },
                person_in_charge: { type: Type.STRING, description: "Người phụ trách / Trực LĐ" }
              },
              required: ["day", "content"]
            }
          }
        },
        required: ["title", "days"]
      };

      let parsedData: any = null;
      let lastModelError: any = null;

      // Try candidates sequentially with smart retry/fallback
      for (const modelToTry of candidateModels) {
        try {
          console.log(`[OCR SERVER] Executing generateContent with model: ${modelToTry}`);
          const response = await ai.models.generateContent({
            model: modelToTry,
            contents: { parts },
            config: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              responseSchema
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

          parsedData = JSON.parse(cleanText);
          console.log(`[OCR SERVER] Model ${modelToTry} SUCCESS!`);
          break;
        } catch (mErr: any) {
          console.warn(`[OCR SERVER] Model ${modelToTry} failed:`, mErr.status || mErr.message);
          lastModelError = mErr;
          if (mErr.status === 401) {
            throw mErr;
          }
        }
      }

      if (!parsedData) {
        throw lastModelError || new Error('Không thể nhận diện hình ảnh sau khi thử tất cả các model AI.');
      }

      return res.json({ success: true, data: parsedData });
    } catch (err: any) {
      console.error('OCR API Error:', err);
      
      let status = 'INTERNAL';
      let code = 500;
      let message = err.message || 'Không thể nhận diện hình ảnh. Vui lòng thử lại.';

      // Classify error type (Requirement 11)
      const errStr = String(err.message || '').toLowerCase();
      const errStatus = Number(err.status || 0);

      if (errStatus === 401 || errStatus === 403 || errStr.includes('api_key') || errStr.includes('unauthorized') || errStr.includes('key not valid')) {
        code = 401;
        status = 'UNAUTHORIZED';
        message = 'API key không có quyền sử dụng model OCR hoặc không hợp lệ.';
      } else if (errStatus === 404 || errStr.includes('not found') || errStr.includes('no longer available')) {
        code = 404;
        status = 'NOT_FOUND';
        message = 'Model OCR không khả dụng hoặc không tồn tại.';
      } else if (errStatus === 429 || errStr.includes('quota') || errStr.includes('rate limit')) {
        code = 429;
        status = 'RESOURCE_EXHAUSTED';
        message = 'API OCR đã đạt giới hạn sử dụng (Quota Exceeded).';
      } else if (errStatus === 503 || errStr.includes('unavailable') || errStr.includes('busy') || errStr.includes('overloaded') || errStr.includes('high demand')) {
        code = 503;
        status = 'UNAVAILABLE';
        message = 'Dịch vụ OCR đang tạm thời quá tải hoặc đang bận.';
      } else if (errStatus === 400 || errStr.includes('invalid') || errStr.includes('bad request')) {
        code = 400;
        status = 'INVALID_ARGUMENT';
        message = 'Ảnh không đúng định dạng hoặc yêu cầu không hợp lệ.';
      }

      return res.status(code).json({
        error: {
          code,
          status,
          message
        }
      });
    }
  });

  // Determine if running in production mode
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    (!process.env.npm_lifecycle_event && fs.existsSync(path.join(__dirname, 'dist', 'index.html')));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static build
    const distPath = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
      ? path.join(__dirname, 'dist')
      : fs.existsSync(path.join(__dirname, 'build', 'index.html'))
      ? path.join(__dirname, 'build')
      : fs.existsSync(path.join(__dirname, 'index.html'))
      ? __dirname
      : path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
