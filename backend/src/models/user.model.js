import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  phone: { type: String },
  password: { type: String, required: true },
  locale: { type: String, default: 'it-IT' },
  roles: { type: [String], default: ['consumer'] }, // consumer, master, admin
  kyc_status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
  wallet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
  free_call_used: { type: Boolean, default: false },
  first_name: { type: String, trim: true },
  last_name: { type: String, trim: true },
  display_name: { type: String, trim: true },
  bio: { type: String, trim: true, maxlength: 600 },
  location: { type: String, trim: true, maxlength: 120 },
  avatar_url: { type: String },
  avatar_key: { type: String },
  is_email_verified: { type: Boolean, default: false },
  email_verification_token: { type: String },
  email_verification_expires: { type: Date }
}, { timestamps: true });

userSchema.pre('save', async function hashPass(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.createEmailVerification = function () {
  const token = crypto.randomBytes(48).toString('hex');
  this.email_verification_token = token;
  this.email_verification_expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
  this.is_email_verified = false;
  return token;
};

userSchema.methods.clearEmailVerification = function () {
  this.email_verification_token = undefined;
  this.email_verification_expires = undefined;
  this.is_email_verified = true;
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject({ getters: true, virtuals: false });
  delete obj.password;
  delete obj.email_verification_token;
  delete obj.email_verification_expires;
  return obj;
};

export const User = mongoose.model('User', userSchema);
