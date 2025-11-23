import express from 'express';

import adminRoutes from '../routes/admin.routes.js';
import webhookRoutes from '../routes/webhook.routes.js';

export function createOperationsApp() {
  const app = express.Router();

  app.use('/admin', adminRoutes);
  app.use('/webhooks', webhookRoutes);

  return app;
}
