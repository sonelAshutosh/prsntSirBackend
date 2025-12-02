import Classroom from '../models/classroom.js'
import User from '../models/user.js'

// Generate a unique 6-character classroom code
const generateClassCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return code
}

// @desc    Create a new classroom
// @route   POST /api/classroom/create
// @access  Private (Teacher only)
export const createClassroom = async (req, res) => {
  try {
    // Check if user is a teacher
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only teachers can create classrooms.',
      })
    }

    const { name, subject } = req.body

    // Validate required fields
    if (!name || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Please provide classroom name and subject',
      })
    }

    // Generate unique classroom code
    let code = generateClassCode()
    let codeExists = await Classroom.findOne({ code })

    // Regenerate if code already exists
    while (codeExists) {
      code = generateClassCode()
      codeExists = await Classroom.findOne({ code })
    }

    // Create classroom
    const classroom = await Classroom.create({
      name,
      subject,
      code,
      teachers: [req.user._id],
    })

    res.status(201).json({
      success: true,
      message: 'Classroom created successfully',
      data: {
        classroom: {
          id: classroom._id,
          name: classroom.name,
          subject: classroom.subject,
          code: classroom.code,
          teachers: classroom.teachers,
          createdAt: classroom.createdAt,
          updatedAt: classroom.updatedAt,
        },
      },
    })
  } catch (error) {
    console.error('Create classroom error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Get all classrooms for a teacher
// @route   GET /api/classroom/my-classes
// @access  Private (Teacher only)
export const getTeacherClassrooms = async (req, res) => {
  try {
    // Check if user is a teacher
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only teachers can access this endpoint.',
      })
    }

    const classrooms = await Classroom.find({
      teachers: req.user._id,
    }).sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      data: {
        classrooms: classrooms.map((classroom) => ({
          id: classroom._id,
          name: classroom.name,
          subject: classroom.subject,
          code: classroom.code,
          teachers: classroom.teachers,
          createdAt: classroom.createdAt,
          updatedAt: classroom.updatedAt,
        })),
      },
    })
  } catch (error) {
    console.error('Get teacher classrooms error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Get classroom by ID
// @route   GET /api/classroom/:id
// @access  Private
export const getClassroomById = async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id).populate(
      'teachers',
      'firstName lastName email'
    )

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: 'Classroom not found',
      })
    }

    res.status(200).json({
      success: true,
      data: {
        classroom: {
          id: classroom._id,
          name: classroom.name,
          subject: classroom.subject,
          code: classroom.code,
          teachers: classroom.teachers,
          createdAt: classroom.createdAt,
          updatedAt: classroom.updatedAt,
        },
      },
    })
  } catch (error) {
    console.error('Get classroom error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Update classroom
// @route   PUT /api/classroom/:id
// @access  Private (Teacher only)
export const updateClassroom = async (req, res) => {
  try {
    const { name, subject } = req.body

    const classroom = await Classroom.findById(req.params.id)

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: 'Classroom not found',
      })
    }

    // Check if user is a teacher of this classroom
    if (
      req.user.role !== 'TEACHER' ||
      !classroom.teachers.includes(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a teacher of this classroom.',
      })
    }

    // Update fields
    if (name) classroom.name = name
    if (subject) classroom.subject = subject

    const updatedClassroom = await classroom.save()

    res.status(200).json({
      success: true,
      message: 'Classroom updated successfully',
      data: {
        classroom: {
          id: updatedClassroom._id,
          name: updatedClassroom.name,
          subject: updatedClassroom.subject,
          code: updatedClassroom.code,
          teachers: updatedClassroom.teachers,
          createdAt: updatedClassroom.createdAt,
          updatedAt: updatedClassroom.updatedAt,
        },
      },
    })
  } catch (error) {
    console.error('Update classroom error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Delete classroom
// @route   DELETE /api/classroom/:id
// @access  Private (Teacher only)
export const deleteClassroom = async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id)

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: 'Classroom not found',
      })
    }

    // Check if user is a teacher of this classroom
    if (
      req.user.role !== 'TEACHER' ||
      !classroom.teachers.includes(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a teacher of this classroom.',
      })
    }

    await Classroom.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      message: 'Classroom deleted successfully',
    })
  } catch (error) {
    console.error('Delete classroom error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Regenerate classroom code
// @route   POST /api/classroom/:id/regenerate-code
// @access  Private (Teacher only)
export const regenerateClassCode = async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id)

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: 'Classroom not found',
      })
    }

    // Check if user is a teacher of this classroom
    if (
      req.user.role !== 'TEACHER' ||
      !classroom.teachers.includes(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a teacher of this classroom.',
      })
    }

    // Generate new unique code
    let newCode = generateClassCode()
    let codeExists = await Classroom.findOne({ code: newCode })

    // Regenerate if code already exists
    while (codeExists) {
      newCode = generateClassCode()
      codeExists = await Classroom.findOne({ code: newCode })
    }

    // Update classroom code
    classroom.code = newCode
    const updatedClassroom = await classroom.save()

    res.status(200).json({
      success: true,
      message: 'Classroom code regenerated successfully',
      data: {
        classroom: {
          id: updatedClassroom._id,
          name: updatedClassroom.name,
          subject: updatedClassroom.subject,
          code: updatedClassroom.code,
          teachers: updatedClassroom.teachers,
          createdAt: updatedClassroom.createdAt,
          updatedAt: updatedClassroom.updatedAt,
        },
      },
    })
  } catch (error) {
    console.error('Regenerate classroom code error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}
