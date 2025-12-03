import express from 'express'
import {
  createAttendanceSession,
  getSessionStudents,
  markAttendance,
  endAttendanceSession,
  getClassroomSessions,
  getStudentAttendanceHistory,
} from '../controllers/attendanceController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

// All routes are protected (require authentication)
router.use(protect)

// POST /api/attendance/session/create - Create new attendance session
router.post('/session/create', createAttendanceSession)

// GET /api/attendance/session/:sessionId/students - Get students for session
router.get('/session/:sessionId/students', getSessionStudents)

// POST /api/attendance/session/:sessionId/mark - Mark student attendance
router.post('/session/:sessionId/mark', markAttendance)

// POST /api/attendance/session/:sessionId/end - End attendance session
router.post('/session/:sessionId/end', endAttendanceSession)

// GET /api/attendance/classroom/:classroomId/sessions - Get all sessions for a classroom (Teacher)
router.get('/classroom/:classroomId/sessions', getClassroomSessions)

// GET /api/attendance/classroom/:classroomId/student - Get student attendance history (Student)
router.get('/classroom/:classroomId/student', getStudentAttendanceHistory)

export default router
