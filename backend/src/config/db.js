import mongoose from 'mongoose';

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI missing');
  process.exit(1);
}

mongoose.connect(uri, { autoIndex: true })
  .then(() => console.log('Mongo connected'))
  .catch(err => {
    console.error('Mongo error', err.message);
    process.exit(1);
  });

export default mongoose;
