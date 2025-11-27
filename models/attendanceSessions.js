import mongoose from 'mongoose'

const AttendanceSessionSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mode: { type: String, enum: ['MANUAL', 'QR'], default: 'MANUAL' },
    endedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true }
)

export default mongoose.models.AttendanceSession ||
  mongoose.model('AttendanceSession', AttendanceSessionSchema)
