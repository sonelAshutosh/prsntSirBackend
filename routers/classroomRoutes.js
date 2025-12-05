import express from 'express'
import {
  createClassroom,
  getTeacherClassrooms,
  getClassroomById,
  updateClassroom,
  deleteClassroom,
  regenerateClassCode,
  addCoTeacher,
  removeCoTeacher,
  getClassroomStudents,
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

// GET /api/classroom/:id/students - Get students enrolled in classroom
router.get('/:id/students', getClassroomStudents)

// PUT /api/classroom/:id - Update classroom
router.put('/:id', updateClassroom)

// DELETE /api/classroom/:id - Delete classroom
router.delete('/:id', deleteClassroom)

// POST /api/classroom/:id/regenerate-code - Regenerate classroom code
router.post('/:id/regenerate-code', regenerateClassCode)

// POST /api/classroom/:id/add-coteacher - Add co-teacher to classroom
router.post('/:id/add-coteacher', addCoTeacher)

// POST /api/classroom/:id/remove-coteacher - Remove co-teacher from classroom
router.post('/:id/remove-coteacher', removeCoTeacher)

export default router
