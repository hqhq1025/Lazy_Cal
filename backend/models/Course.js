const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    teacher: { type: String, default: '', trim: true },
    day: { type: String, default: '', trim: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    location: { type: String, default: '', trim: true },
    weeks: { type: [Number], default: [] },
    metadata: { type: Map, of: String, default: undefined }
  },
  {
    timestamps: true
  }
);

courseSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  }
});

module.exports = mongoose.model('Course', courseSchema);
