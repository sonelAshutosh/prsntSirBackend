import express from 'express'
import {
  getStudentProfile,
  regenerateQRCode,
  joinClassroom,
  getStudentClassrooms,
} from '../controllers/studentController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

// All routes are protected (require authentication)
router.use(protect)

// GET /api/student/profile - Get student profile with QR code
router.get('/profile', getStudentProfile)

// POST /api/student/regenerate-qr - Regenerate QR code
router.post('/regenerate-qr', regenerateQRCode)

// POST /api/student/join-class - Join a classroom
router.post('/join-class', joinClassroom)

// GET /api/student/my-classes - Get student's joined classes
router.get('/my-classes', getStudentClassrooms)

export default router
