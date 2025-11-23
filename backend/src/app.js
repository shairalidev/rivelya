import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import './config/db.js';
import { sessionScheduler } from './services/session-scheduler.service.js';
import { sessionLifecycle } from './services/session-lifecycle.service.js';

import { registerServiceApps } from './apps/index.js';

import { notFound, errorHandler } from './middleware/error.js';

export const app = express();

const defaultOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL?.replace('http://', 'https://'),
  process.env.PUBLIC_SITE_URL,
  process.env.PUBLIC_APP_URL,
  'https://rivelya.duckdns.org',
  'http://rivelya.duckdns.org',
  'https://rivelya.duckdns.org:5173',
  'http://rivelya.duckdns.org:5173',
  'https://www.rivelya.duckdns.org',
  'http://localhost:5173',
  'https://65.0.177.242',
  'http://65.0.177.242',
  'https://65.0.177.242:5173',
  'http://65.0.177.242:5173'
];

if (process.env.CORS_ALLOWED_ORIGINS) {
  defaultOrigins.push(...process.env.CORS_ALLOWED_ORIGINS.split(',').map(value => value.trim()));
}

export const allowedOrigins = [...new Set(defaultOrigins.filter(Boolean))];

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some(allowed => {
      if (!allowed) return false;
      if (origin === allowed) return true;
      return origin.startsWith(`${allowed}/`);
    });
    if (isAllowed) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

registerServiceApps(app);

app.use(notFound);
app.use(errorHandler);

// Start session services
sessionScheduler.start();
sessionLifecycle.start();
