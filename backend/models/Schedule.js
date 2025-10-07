const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    start: { type: Date, required: true },
    end: { type: Date },
    allDay: { type: Boolean, default: false },
    durationMinutes: { type: Number },
    recurrence: { type: String, default: '不重复', trim: true },
    notes: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    source: { type: String, default: 'AI 助手', trim: true },
    originalInput: { type: String, default: '' },
    reminders: { type: [Date], default: [] }
  },
  { timestamps: true }
);

scheduleSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  }
});

module.exports = mongoose.model('Schedule', scheduleSchema);
