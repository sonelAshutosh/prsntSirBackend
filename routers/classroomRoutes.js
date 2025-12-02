import express from 'express'
import {
  createClassroom,
  getTeacherClassrooms,
  getClassroomById,
  updateClassroom,
  deleteClassroom,
  regenerateClassCode,
} from '../controllers/classroomController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

// All routes are protected (require authentication)
router.use(protect)

// POST /api/classroom/create - Create a new classroom
router.post('/create', createClassroom)

// GET /api/classroom/my-classes - Get teacher's classrooms
router.get('/my-classes', getTeacherClassrooms)

// GET /api/classroom/:id - Get classroom by ID
router.get('/:id', getClassroomById)

// PUT /api/classroom/:id - Update classroom
router.put('/:id', updateClassroom)

// DELETE /api/classroom/:id - Delete classroom
router.delete('/:id', deleteClassroom)

// POST /api/classroom/:id/regenerate-code - Regenerate classroom code
router.post('/:id/regenerate-code', regenerateClassCode)

export default router
