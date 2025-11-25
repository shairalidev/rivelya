import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import './config/db.js';
import { sessionScheduler } from './services/session-scheduler.service.js';
import { sessionLifecycle } from './services/session-lifecycle.service.js';

import authRoutes from './routes/auth.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import sessionRoutes from './routes/session.routes.js';
import reviewRoutes from './routes/review.routes.js';
import adminRoutes from './routes/admin.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import cmsRoutes from './routes/cms.routes.js';
import profileRoutes from './routes/profile.routes.js';
import availabilityRoutes from './routes/availability.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import chatRoutes from './routes/chat.routes.js';
import voiceRoutes from './routes/voice.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import sessionNotificationRoutes from './routes/session-notification.routes.js';
import masterRoutes from './routes/master.routes.js';
import mediaRoutes from './routes/media.routes.js';
import sessionManagementRoutes from './routes/session-management.routes.js';
import presenceRoutes from './routes/presence.routes.js';

import { notFound, errorHandler } from './middleware/error.js';

export const app = express();

// Support both root and /api mount (covers nginx configurations that keep or strip /api)
const routePrefixes = ['', '/api'];

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

routePrefixes.forEach(prefix => {
  const mount = path => `${prefix}${path}`;
  app.use(mount('/auth'), authRoutes);
  app.use(mount('/catalog'), catalogRoutes);
  app.use(mount('/wallet'), walletRoutes);
  app.use(mount('/session'), sessionRoutes);
  app.use(mount('/reviews'), reviewRoutes);
  app.use(mount('/admin'), adminRoutes);
  app.use(mount('/cms'), cmsRoutes);
  app.use(mount('/webhooks'), webhookRoutes);
  app.use(mount('/profile'), profileRoutes);
  app.use(mount('/availability'), availabilityRoutes);
  app.use(mount('/bookings'), bookingRoutes);
  app.use(mount('/chat'), chatRoutes);
  app.use(mount('/voice'), voiceRoutes);
  app.use(mount('/notifications'), notificationRoutes);
  app.use(mount('/session-notifications'), sessionNotificationRoutes);
  app.use(mount('/master'), masterRoutes);
  app.use(mount('/media'), mediaRoutes);
  app.use(mount('/session-management'), sessionManagementRoutes);
  app.use(mount('/presence'), presenceRoutes);
});

app.use(notFound);
app.use(errorHandler);

// Start session services
sessionScheduler.start();
sessionLifecycle.start();
