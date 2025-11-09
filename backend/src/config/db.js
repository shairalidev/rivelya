import mongoose from 'mongoose';
import dotenv from 'dotenv';    

dotenv.config();

const uri = process.env.MONGO_URI || dotenv.config().parsed.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI missing');
  process.exit(1);
}

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Mongo connected'))
  .catch(err => console.error('Mongo connection error:', err));
