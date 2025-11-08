import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  phone: { type: String },
  password: { type: String, required: true },
  locale: { type: String, default: 'it-IT' },
  roles: { type: [String], default: ['consumer'] }, // consumer, master, admin
  kyc_status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
  wallet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
  free_call_used: { type: Boolean, default: false }
}, { timestamps: true });

userSchema.pre('save', async function hashPass(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export const User = mongoose.model('User', userSchema);
