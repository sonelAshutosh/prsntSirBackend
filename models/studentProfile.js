import mongoose from 'mongoose'

const StudentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    studentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    qrCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    classesJoined: [
      {
        classroomId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Classroom',
          required: true,
        },
        status: {
          type: String,
          enum: ['ACTIVE', 'LEFT'],
          default: 'ACTIVE',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        leftAt: {
          type: Date,
          default: null,
        },
      },
    ],
  },
  { timestamps: true }
)

export default mongoose.models.StudentProfile ||
  mongoose.model('StudentProfile', StudentProfileSchema)
