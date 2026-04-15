import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import compression from "compression";
import helmet from "helmet";
import { supabase, isSupabaseConfigured } from "./src/lib/supabase";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_VERSION = "1.2.0";
const LAST_UPDATED = new Date().toISOString();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security and Performance
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for easier integration with external assets if needed
  }));
  app.use(compression());
  app.use(express.json());
  app.use(cookieParser());
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_KEY || 'smk-prima-unggul-default-key'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === "production",
    sameSite: 'lax',
    httpOnly: true
  }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      supabase: isSupabaseConfigured,
      version: APP_VERSION,
      lastUpdated: LAST_UPDATED
    });
  });

  app.post("/api/login", async (req: any, res) => {
    const { username, password, major } = req.body;
    
    if (!isSupabaseConfigured) {
      return res.status(503).json({ success: false, message: "Database tidak terkonfigurasi. Hubungi administrator." });
    }

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', username)
        .single();
      
      if (error) throw error;

      if (user && (user.password === password || user.password.toLowerCase() === password.toLowerCase())) {
        req.session.user = { username: user.username, name: user.name, role: user.role, major };
        res.json({ success: true, user: req.session.user });
      } else {
        res.status(401).json({ success: false, message: "Username atau Password salah" });
      }
    } catch (err) {
      console.error("Supabase Login Error:", err);
      res.status(401).json({ success: false, message: "Username atau Password salah" });
    }
  });

  app.post("/api/exam/submit", async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    
    const { score, totalQuestions, wrong, major } = req.body;

    if (!isSupabaseConfigured) {
      return res.status(503).json({ success: false, message: "Database tidak terkonfigurasi." });
    }

    try {
      const { error } = await supabase
        .from('exam_results')
        .insert([
          { 
            username: req.session.user.username, 
            score, 
            total_questions: totalQuestions,
            wrong_answers: wrong,
            major: major,
            status: (score / totalQuestions) * 100 >= 70 ? 'LULUS' : 'TIDAK LULUS'
          }
        ]);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error("Supabase Submit Error:", err);
      res.status(500).json({ success: false });
    }
  });

  app.post("/api/register", async (req: any, res) => {
    const { username, password, name, role, major } = req.body;
    
    if (!isSupabaseConfigured) {
      return res.status(503).json({ 
        success: false, 
        message: "Registrasi tidak tersedia saat ini. Database tidak terkonfigurasi." 
      });
    }

    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .ilike('username', username)
        .single();
      
      if (existingUser) {
        return res.status(400).json({ success: false, message: "Username sudah digunakan" });
      }

      // Note: We are including 'major' in the insert. 
      // User needs to update their Supabase table to include this column.
      const { error } = await supabase
        .from('users')
        .insert([{ username, password, name, role, major }]);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error("Supabase Register Error:", err);
      res.status(500).json({ success: false, message: "Gagal mendaftar. Pastikan tabel 'users' memiliki kolom 'major'." });
    }
  });

  app.get("/api/admin/results", async (req: any, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Akses ditolak" });
    }

    if (!isSupabaseConfigured) {
      return res.status(503).json({ success: false, message: "Database tidak terkonfigurasi." });
    }

    try {
      const { data, error } = await supabase
        .from('exam_results')
        .select('*')
        .order('completed_at', { ascending: false });
      
      if (error) throw error;
      res.json({ success: true, results: data });
    } catch (err) {
      console.error("Supabase Admin Results Error:", err);
      res.status(500).json({ success: false });
    }
  });

  app.get("/api/me", (req: any, res) => {
    if (req.session.user) {
      res.json({ success: true, user: req.session.user });
    } else {
      res.status(401).json({ success: false });
    }
  });

  app.post("/api/logout", (req: any, res) => {
    req.session = null;
    res.json({ success: true });
  });

  // Google OAuth Structure
  app.get("/api/auth/google/url", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ success: false, message: "Google Login belum dikonfigurasi." });
    }

    const redirectUri = `${process.env.APP_URL}/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account"
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  });

  // Actual Callback (Structure)
  app.get("/auth/google/callback", async (req, res) => {
    // In a real app, you'd exchange the code for tokens here
    // For now, we'll just redirect back with a success message
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();

export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
