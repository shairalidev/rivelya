import mongoose from 'mongoose';

const weeklySlotSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  start: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
  end: { type: String, required: true, match: /^\d{2}:\d{2}$/ }
}, { _id: false });

const masterSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  status: { type: String, enum: ['draft', 'active', 'suspended'], default: 'draft' },
  kyc_level: { type: String, default: 'none' },
  display_name: { type: String, default: '' },
  headline: { type: String, default: '' },
  categories: { type: [String], index: true }, // cartomancy-divination, spirituality-intuition, inner-wellness-life-coaching, etc.
  bio: String,
  specialties: { type: [String], default: [] },
  experience_years: { type: Number, default: 0 },
  languages: { type: [String], default: ['it'] },
  rate_phone_cpm: { type: Number, min: 0, default: 0 }, // cents per minute
  rate_chat_cpm: { type: Number, min: 0, default: 0 },
  rate_video_cpm: { type: Number, min: 0, default: 0 },
  services: {
    chat: { type: Boolean, default: true },
    phone: { type: Boolean, default: true },
    video: { type: Boolean, default: false }
  },
  availability: { type: String, enum: ['online', 'busy', 'offline'], default: 'offline' },
  media: {
    avatar_url: String,
    intro_video_url: String
  },
  working_hours: {
    timezone: { type: String, default: 'Europe/Rome' },
    slots: { type: [weeklySlotSchema], default: [] },
    notes: { type: String, default: '' }
  },
  kpis: {
    lifetime_calls: { type: Number, default: 0 },
    lifetime_chats: { type: Number, default: 0 },
    avg_rating: { type: Number, default: 0 },
    review_count: { type: Number, default: 0 }
  }
}, { timestamps: true });

export const Master = mongoose.model('Master', masterSchema);
