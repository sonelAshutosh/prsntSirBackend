import mongoose from 'mongoose'

const ClassroomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    subject: { type: String, required: true },
    code: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
)

// teachers: many-to-many via array of ObjectId references
ClassroomSchema.add({
  teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
})

export default mongoose.models.Classroom ||
  mongoose.model('Classroom', ClassroomSchema)
