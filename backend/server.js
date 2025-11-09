// Load environment first
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env.local'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env.local'),
  path.resolve(__dirname, '..', '.env'),
];

for (const candidate of envCandidates) {
  if (!fs.existsSync(candidate)) continue;

  const result = dotenv.config({ path: candidate });
  if (!result.error && process.env.MONGO_URI) {
    break;
  }
}

// Final fallback to default resolution in case none of the candidate files exist
if (!process.env.MONGO_URI) {
  dotenv.config();
}

// Import rest after
import http from 'http';
import { app } from './src/app.js';

const port = process.env.PORT || 8080;
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`API up on :${port}`);
});
