import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  provider: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  frequency: {
    type: {
      type: String,
      enum: ['interval', 'cron'],
      required: true,
    },
    value: { type: String, required: true },
    hours: { type: [Number], default: undefined },
    daysOfWeek: { type: [Number], default: undefined },
    daysOfMonth: { type: [Number], default: undefined },
  },
  timezone: { type: String, default: 'UTC' },
  filters: {
    warehouses: { type: [String], default: undefined },
    productTypes: { type: [String], default: undefined },
    categories: { type: [String], default: undefined },
  },
  settings: {
    retryOnFailure: { type: Boolean, default: true },
    maxRetries: { type: Number, default: 3 },
    notifyOnCompletion: { type: Boolean, default: true },
    notifyOnFailure: { type: Boolean, default: true },
    skipWeekends: { type: Boolean, default: false },
    skipHolidays: { type: Boolean, default: false },
  },
  notifications: {
    email: { type: [String], default: undefined },
    slack: {
      webhook: { type: String },
      channel: { type: String },
    },
    webhook: {
      url: { type: String },
      headers: { type: mongoose.Schema.Types.Mixed },
    },
  },
  lastRun: { type: Date },
  nextRun: { type: Date },
  status: {
    type: String,
    enum: ['active', 'paused', 'inactive'],
    default: 'active',
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
});

scheduleSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const ScheduleModel =
  mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);

export default ScheduleModel;