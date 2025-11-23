import { createCommerceApp } from './commerce.app.js';
import { createCommunicationApp } from './communication.app.js';
import { createContentApp } from './content.app.js';
import { createIdentityApp } from './identity.app.js';
import { createOperationsApp } from './operations.app.js';

export function registerServiceApps(app) {
  const services = [
    createIdentityApp(),
    createContentApp(),
    createCommerceApp(),
    createCommunicationApp(),
    createOperationsApp()
  ];

  services.forEach(serviceApp => app.use(serviceApp));
}
