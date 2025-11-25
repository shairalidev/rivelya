import mongoose from 'mongoose';

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB;

if (!uri) {
  console.error('❌ ERROR: MONGO_URI not found in environment');
  process.exit(1);
}

const connect = async () => {
  try {
    await mongoose.connect(uri, {
      dbName: dbName || undefined,
      serverSelectionTimeoutMS: 15_000
    });
    console.log('✅ Mongo connected');
  } catch (err) {
    console.error('❌ Mongo connection error:', err?.message || err);
    console.error('- Check that your IP is whitelisted on Atlas and credentials are valid.');
    console.error('- Ensure the SRV URI includes the db name, e.g. mongodb+srv://user:pass@host/dbname');
    process.exit(1);
  }
};

connect();
