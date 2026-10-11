import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      status: 'READY',
      endpoint: '/api/upload-image',
      message: 'Upload API is operational. Please use POST with multipart/form-data.'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: `Phương thức ${req.method} không được hỗ trợ. Vui lòng sử dụng POST.`
    });
  }

  upload.any()(req, res, (err: any) => {
    if (err) {
      console.error('[API UPLOAD-IMAGE] Multer error:', err);
      const isSizeError = err.code === 'LIMIT_FILE_SIZE' || (err.message && err.message.includes('large'));
      return res.status(isSizeError ? 413 : 400).json({
        success: false,
        error: isSizeError ? 'Dung lượng tệp vượt quá giới hạn cho phép (25MB).' : (err.message || 'Lỗi xử lý tệp tải lên.')
      });
    }

    const files = req.files as any[];
    const file = files && files.length > 0 ? files[0] : req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp tệp tin tải lên (trường "image" hoặc "file").'
      });
    }

    const mimeType = file.mimetype || 'image/jpeg';
    const base64Data = file.buffer.toString('base64');
    const base64Url = `data:${mimeType};base64,${base64Data}`;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeOrigName = file.originalname ? file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_') : 'image.jpg';
    const filename = `upload-${uniqueSuffix}-${safeOrigName}`;

    return res.status(200).json({
      success: true,
      url: base64Url,
      filename: filename,
      originalName: file.originalname || filename,
      size: file.size,
      mimeType: mimeType,
      base64: base64Url
    });
  });
}
