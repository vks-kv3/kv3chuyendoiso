import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'submissions_memory.json');

// Helper to read submissions from persistent disk file
function getSubmissionsFromFile(): any[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.error('Error reading submissions_memory.json:', err);
  }
  return [];
}

// Helper to save submissions to persistent disk file
function saveSubmissionsToFile(submissions: any[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing submissions_memory.json:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API endpoint: Get all submissions from internal memory
  app.get('/api/submissions', (_req, res) => {
    const list = getSubmissionsFromFile();
    res.json(list);
  });

  // API endpoint: Record exam submission into persistent memory file
  app.post('/api/submit-exam', (req, res) => {
    try {
      const { session, config } = req.body;
      const phone = config?.organizerPhone || '09837645';

      if (!session || !session.candidate) {
        return res.status(400).json({ success: false, message: 'Thiếu dữ liệu bài thi' });
      }

      const existing = getSubmissionsFromFile();
      // Prepend newest submission
      const updated = [session, ...existing.filter((s: any) => s.id !== session.id)];
      saveSubmissionsToFile(updated);

      console.log(`[Memory Saved] Candidate: ${session.candidate.fullName} (${session.candidate.position}), Score: ${session.score}/10, Code: ${session.certificateCode}`);

      return res.json({
        success: true,
        message: `Đã lưu trữ bài thi thành công vào bộ nhớ hệ thống. Tổng số: ${updated.length} bài.`,
      });
    } catch (err: any) {
      console.error('[Exam Submission] Server error:', err);
      return res.status(500).json({
        success: false,
        message: 'Lỗi ghi nhận bài thi vào bộ nhớ máy chủ',
      });
    }
  });

  // API endpoint: Clear memory
  app.delete('/api/submissions', (_req, res) => {
    saveSubmissionsToFile([]);
    res.json({ success: true, message: 'Đã xóa bộ nhớ bài thi thành công' });
  });

  // In production, serve dist folder; in dev, mount Vite middleware
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
