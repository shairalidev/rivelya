import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import './config/db.js';

import authRoutes from './routes/auth.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import sessionRoutes from './routes/session.routes.js';
import reviewRoutes from './routes/review.routes.js';
import adminRoutes from './routes/admin.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import cmsRoutes from './routes/cms.routes.js';

import { notFound, errorHandler } from './middleware/error.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/catalog', catalogRoutes);
app.use('/wallet', walletRoutes);
app.use('/session', sessionRoutes);
app.use('/reviews', reviewRoutes);
app.use('/admin', adminRoutes);
app.use('/cms', cmsRoutes);
app.use('/webhooks', webhookRoutes);

app.use(notFound);
app.use(errorHandler);
