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
  // Expert profile fields
  tax_code: { type: String, trim: true, maxlength: 16 },
  vat_number: { type: String, trim: true, maxlength: 11 },
  birth_date: { type: Date },
  birth_place: { type: String, trim: true, maxlength: 120 },
  birth_province: { type: String, trim: true, maxlength: 80 },
  birth_country: { type: String, trim: true, maxlength: 80 },
  address: { type: String, trim: true, maxlength: 200 },
  zip_code: { type: String, trim: true, maxlength: 20 },
  city: { type: String, trim: true, maxlength: 120 },
  province: { type: String, trim: true, maxlength: 120 },
  country: { type: String, trim: true, maxlength: 120 },
  iban: { type: String, trim: true, maxlength: 34 },
  tax_regime: { type: String, enum: ['forfettario', 'ordinario', 'ritenuta_acconto'], default: 'forfettario' },
  avatar_url: { type: String },
  avatar_key: { type: String },
  is_email_verified: { type: Boolean, default: false },
  email_verification_token: { type: String },
  email_verification_expires: { type: Date },
  password_reset_token: { type: String },
  password_reset_expires: { type: Date },
  // Horoscope fields
  horoscope_birth_date: { type: Date },
  horoscope_birth_time: { type: String, trim: true, maxlength: 5 }, // HH:MM format
  // Online presence tracking
  is_online: { type: Boolean, default: false },
  last_seen: { type: Date, default: Date.now },
  socket_ids: { type: [String], default: [] }
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

userSchema.methods.createPasswordReset = function () {
  const token = crypto.randomBytes(48).toString('hex');
  this.password_reset_token = token;
  this.password_reset_expires = new Date(Date.now() + 1000 * 60 * 60); // 1h
  return token;
};

userSchema.methods.clearPasswordReset = function () {
  this.password_reset_token = undefined;
  this.password_reset_expires = undefined;
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject({ getters: true, virtuals: false });
  delete obj.password;
  delete obj.email_verification_token;
  delete obj.email_verification_expires;
  return obj;
};

export const User = mongoose.model('User', userSchema);
