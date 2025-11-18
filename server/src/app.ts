import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// Routes
import authRoutes from './routes/auth.routes';
import tournamentRoutes from './routes/tournament.routes';
import teamRoutes from './routes/team.routes';
import userRoutes from './routes/user.routes';
import matchRoutes from './routes/match.routes';
import adminRoutes from './routes/admin.routes';
import kingRoutes from './routes/king.routes';
import playerRankingRoutes from './routes/playerRanking.routes';

// Middlewares
import { errorHandler } from './middlewares/error.middleware';
import { requestLogger } from './middlewares/logger.middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security & Performance Middlewares ---

// Helmet for security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting - more permissive in development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 500, // 500 in dev, 100 in prod
  message: 'Too many requests from this IP, please try again later.',
});

// Apply rate limiting to all API routes except auth check endpoint
app.use('/api/', (req, res, next) => {
  // Skip rate limiting for auth check endpoint which is called frequently
  if (req.path === '/auth/me') {
    return next();
  }
  return limiter(req, res, next);
});

// Compression
app.use(compression());

// --- Body Parsing ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Session Configuration ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'une-cle-secrete-a-changer',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset maxAge on every response
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (increased from 24h)
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  },
}));

// --- Static Files (for uploads) ---
// Path works both in development and Docker:
// Dev: __dirname = /app/server/src → ../public/uploads = /app/public/uploads
// Docker: __dirname = /app/dist → ../public/uploads = /app/public/uploads
const uploadsPath = path.join(__dirname, '../public/uploads');
console.log(`📁 Serving static uploads from: ${uploadsPath}`);
app.use('/uploads', express.static(uploadsPath));

// --- Request Logging ---
if (process.env.NODE_ENV !== 'production') {
  app.use(requestLogger);
}

// --- Health Check ---
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/king', kingRoutes);
app.use('/api/players', playerRankingRoutes);

// --- Error Handler ---
app.use(errorHandler);

// --- 404 Handler ---
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
