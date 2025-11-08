import mongoose from 'mongoose';

const masterSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  status: { type: String, enum: ['draft', 'active', 'suspended'], default: 'draft' },
  kyc_level: { type: String, default: 'none' },
  categories: { type: [String], index: true }, // cartomanzia, legale, coaching, etc.
  bio: String,
  languages: { type: [String], default: ['it'] },
  rate_phone_cpm: { type: Number, required: true, min: 0 }, // cents per minute
  rate_chat_cpm: { type: Number, required: true, min: 0 },
  availability: { type: String, enum: ['online', 'busy', 'offline'], default: 'offline' },
  media: {
    avatar_url: String,
    intro_video_url: String
  },
  kpis: {
    lifetime_calls: { type: Number, default: 0 },
    lifetime_chats: { type: Number, default: 0 },
    avg_rating: { type: Number, default: 0 }
  }
}, { timestamps: true });

export const Master = mongoose.model('Master', masterSchema);
