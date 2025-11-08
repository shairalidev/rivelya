import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('❌ MONGO_URI missing');
  process.exit(1);
}

mongoose.connect(uri)
  .then(() => console.log('✅ Mongo connected'))
  .catch(err => console.error('❌ Mongo connection error:', err));
