import mongoose from 'mongoose';
import { syncAllMasterReviewKPIs } from '../utils/review-sync.js';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rivelya');
    console.log('Connected to MongoDB');

    // Sync all master review KPIs
    console.log('Starting review KPI sync...');
    await syncAllMasterReviewKPIs();
    console.log('Review KPI sync completed successfully');

  } catch (error) {
    console.error('Error during sync:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

main();