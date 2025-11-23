import express from 'express';

import chatRoutes from '../routes/chat.routes.js';
import voiceRoutes from '../routes/voice.routes.js';
import notificationRoutes from '../routes/notification.routes.js';
import presenceRoutes from '../routes/presence.routes.js';
import mediaRoutes from '../routes/media.routes.js';

export function createCommunicationApp() {
  const app = express.Router();

  app.use('/chat', chatRoutes);
  app.use('/voice', voiceRoutes);
  app.use('/notifications', notificationRoutes);
  app.use('/presence', presenceRoutes);
  app.use('/media', mediaRoutes);

  return app;
}
