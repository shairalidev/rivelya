import mongoose from 'mongoose';

const chatCallSchema = new mongoose.Schema({
  thread_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatThread', required: true, index: true },
  caller_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  callee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['calling', 'accepted', 'rejected', 'ended', 'timeout'], 
    default: 'calling',
    index: true 
  },
  started_at: { type: Date },
  ended_at: { type: Date },
  duration_s: { type: Number, default: 0 }
}, { timestamps: true });

chatCallSchema.index({ thread_id: 1, status: 1 });
chatCallSchema.index({ caller_id: 1, status: 1 });
chatCallSchema.index({ callee_id: 1, status: 1 });

export const ChatCall = mongoose.model('ChatCall', chatCallSchema);