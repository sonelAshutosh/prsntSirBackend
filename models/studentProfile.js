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
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom',
      },
    ],
  },
  { timestamps: true }
)

export default mongoose.models.StudentProfile ||
  mongoose.model('StudentProfile', StudentProfileSchema)
