import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import mongoose from 'mongoose'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(express.json({ limit: '2mb' })) // Increased limit for base64 images
app.use(cors())

// ==========================================================
// MongoDB Connection (for serverless)
// ==========================================================
let isConnected = false

const connectDB = async () => {
  if (isConnected) {
    console.log('Using existing MongoDB connection')
    return
  }

  try {
    const db = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    isConnected = db.connections[0].readyState === 1
    console.log('Connected to MongoDB')
  } catch (error) {
    console.error('Error connecting to MongoDB:', error)
    throw error
  }
}

// Connect to database immediately
connectDB()

app.get('/', (req, res) => {
  res.send({ message: 'API is running...' })
})

// ==========================================================
// Routes
// ==========================================================
import authRoutes from './routers/authRoutes.js'
import userRoutes from './routers/userRoutes.js'
import studentRoutes from './routers/studentRoutes.js'
import classroomRoutes from './routers/classroomRoutes.js'
import attendanceRoutes from './routers/attendanceRoutes.js'

app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/student', studentRoutes)
app.use('/api/classroom', classroomRoutes)
app.use('/api/attendance', attendanceRoutes)

// ==========================================================

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
  })
}

// Export for Vercel serverless
export default app
