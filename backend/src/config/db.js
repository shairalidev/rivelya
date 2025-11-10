import mongoose from 'mongoose';

const uri = process.env.MONGO_URI;

if (!uri) {
  console.error('❌ ERROR: MONGO_URI not found in environment');
  process.exit(1);
}

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Mongo connected'))
  .catch(err => console.error('❌ Mongo connection error:', err));
