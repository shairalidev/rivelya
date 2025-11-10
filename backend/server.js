// Load environment first
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment file to load
const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env';

const envPath = path.resolve(__dirname, envFile);

// Load specific env file first
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Fallback to normal `.env` resolution
  dotenv.config();
}

// Validate environment critical variable
if (!process.env.MONGO_URI) {
  console.error('ERROR: MONGO_URI is missing in environment configuration.');
  process.exit(1);
}

// Import application AFTER env is loaded
import http from 'http';
import { app } from './src/app.js';

const port = process.env.PORT || 8080;
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`✅ API running on port ${port} - Mode: ${process.env.NODE_ENV}`);
});
