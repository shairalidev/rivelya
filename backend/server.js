// Load environment first
import dotenv from 'dotenv';
dotenv.config();

// Import rest after
import http from 'http';
import { app } from './src/app.js';

const port = process.env.PORT || 8080;
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`API up on :${port}`);
});
