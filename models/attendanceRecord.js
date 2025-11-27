import mongoose from 'mongoose'

const AttendanceRecordSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      required: true,
    },
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
    },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT'],
      default: 'PRESENT',
    },
  },
  { timestamps: true }
)

// Compound index to ensure a student can only have one record per session
AttendanceRecordSchema.index({ studentId: 1, sessionId: 1 }, { unique: true })

export default mongoose.models.AttendanceRecord ||
  mongoose.model('AttendanceRecord', AttendanceRecordSchema)
