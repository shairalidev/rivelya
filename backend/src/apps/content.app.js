import express from 'express';

import catalogRoutes from '../routes/catalog.routes.js';
import cmsRoutes from '../routes/cms.routes.js';
import reviewRoutes from '../routes/review.routes.js';

export function createContentApp() {
  const app = express.Router();

  app.use('/catalog', catalogRoutes);
  app.use('/cms', cmsRoutes);
  app.use('/reviews', reviewRoutes);

  return app;
}
