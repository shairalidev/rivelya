import mongoose from 'mongoose';

const blockSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  full_day: { type: Boolean, default: false },
  start: { type: String, match: /^\d{2}:\d{2}$/ },
  end: { type: String, match: /^\d{2}:\d{2}$/ }
}, { timestamps: true });

const masterAvailabilitySchema = new mongoose.Schema({
  master_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', index: true, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true }, // 1-12
  blocks: { type: [blockSchema], default: [] }
}, { timestamps: true });

masterAvailabilitySchema.index({ master_id: 1, year: 1, month: 1 }, { unique: true });

export const MasterAvailability = mongoose.model('MasterAvailability', masterAvailabilitySchema);
