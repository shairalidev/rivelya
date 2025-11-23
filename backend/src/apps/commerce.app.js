import express from 'express';

import walletRoutes from '../routes/wallet.routes.js';
import bookingRoutes from '../routes/booking.routes.js';
import sessionRoutes from '../routes/session.routes.js';
import sessionManagementRoutes from '../routes/session-management.routes.js';
import sessionNotificationRoutes from '../routes/session-notification.routes.js';

export function createCommerceApp() {
  const app = express.Router();

  app.use('/wallet', walletRoutes);
  app.use('/bookings', bookingRoutes);
  app.use('/session', sessionRoutes);
  app.use('/session-management', sessionManagementRoutes);
  app.use('/session-notifications', sessionNotificationRoutes);

  return app;
}
