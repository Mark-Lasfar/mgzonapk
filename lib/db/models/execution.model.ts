import mongoose from 'mongoose';

const executionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  scheduleId: { type: String, required: true },
  syncId: { type: String, required: true },
  provider: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  startTime: { type: Date, required: true },
  endTime: Date,
  duration: Number,
  retryCount: { type: Number, default: 0 },
  nextRetry: Date,
  result: mongoose.Schema.Types.Mixed,
  error: {
    message: String,
    code: String,
    stack: String
  },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
  executedBy: { type: String },
  updatedBy: { type: String }
});

executionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  // this.updatedBy = someExternalUser;
  next();
});

const Execution = mongoose.models.Execution || mongoose.model('Execution', executionSchema);
export default Execution;
