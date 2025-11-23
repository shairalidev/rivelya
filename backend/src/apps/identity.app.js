import express from 'express';

import authRoutes from '../routes/auth.routes.js';
import profileRoutes from '../routes/profile.routes.js';
import availabilityRoutes from '../routes/availability.routes.js';
import masterRoutes from '../routes/master.routes.js';

export function createIdentityApp() {
  const app = express.Router();

  app.use('/auth', authRoutes);
  app.use('/profile', profileRoutes);
  app.use('/availability', availabilityRoutes);
  app.use('/master', masterRoutes);

  return app;
}
