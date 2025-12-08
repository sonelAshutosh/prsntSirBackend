import Classroom from '../models/classroom.js'
import User from '../models/user.js'
import StudentProfile from '../models/studentProfile.js'
import AttendanceSession from '../models/attendanceSessions.js'
import AttendanceRecord from '../models/attendanceRecord.js'

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
    })
      .populate('teachers', 'firstName lastName email profileImage')
      .sort({ createdAt: -1 })

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
          studentCount: await StudentProfile.countDocuments({
            'classesJoined.classroomId': classroom._id,
            'classesJoined.status': 'ACTIVE',
          }),
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
// @access  Private (Creator only)
export const deleteClassroom = async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id)

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: 'Classroom not found',
      })
    }

    // Check if user is the creator (0th teacher)
    if (
      req.user.role !== 'TEACHER' ||
      classroom.teachers[0].toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the classroom creator can delete it.',
      })
    }

    // Delete all related data
    const classroomId = req.params.id

    // 1. Delete all attendance sessions
    await AttendanceSession.deleteMany({ classroomId })

    // 2. Delete all attendance records
    await AttendanceRecord.deleteMany({ classroomId })

    // 3. Remove classroom from all student profiles
    await StudentProfile.updateMany(
      { 'classesJoined.classroomId': classroomId },
      { $pull: { classesJoined: { classroomId } } }
    )

    // 4. Delete the classroom
    await Classroom.findByIdAndDelete(classroomId)

    res.status(200).json({
      success: true,
      message: 'Classroom and all related data deleted successfully',
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

// @desc    Add co-teacher to classroom
// @route   POST /api/classroom/:id/add-coteacher
// @access  Private (Teacher only)
export const addCoTeacher = async (req, res) => {
  try {
    const { teacherEmail } = req.body

    if (!teacherEmail) {
      return res.status(400).json({
        success: false,
        message: 'Please provide teacher email',
      })
    }

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

    // Find the teacher to add
    const teacherToAdd = await User.findOne({
      email: teacherEmail.toLowerCase(),
      role: 'TEACHER',
    })

    if (!teacherToAdd) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found or user is not a teacher',
      })
    }

    // Check if teacher is already added
    if (classroom.teachers.includes(teacherToAdd._id)) {
      return res.status(400).json({
        success: false,
        message: 'This teacher is already a co-teacher of this classroom',
      })
    }

    // Add teacher to classroom
    classroom.teachers.push(teacherToAdd._id)
    const updatedClassroom = await classroom.save()

    // Populate teachers for response
    await updatedClassroom.populate('teachers', 'firstName lastName email')

    res.status(200).json({
      success: true,
      message: 'Co-teacher added successfully',
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
    console.error('Add co-teacher error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Remove co-teacher from classroom
// @route   POST /api/classroom/:id/remove-coteacher
// @access  Private (Teacher only)
export const removeCoTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body

    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide teacher ID',
      })
    }

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

    // Check if trying to remove the last teacher
    if (classroom.teachers.length <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the last teacher from the classroom',
      })
    }

    // Check if teacher exists in the classroom
    const teacherIndex = classroom.teachers.findIndex(
      (t) => t.toString() === teacherId
    )

    if (teacherIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found in this classroom',
      })
    }

    // Prevent removing the classroom creator (first teacher at index 0)
    if (teacherIndex === 0) {
      return res.status(403).json({
        success: false,
        message:
          'Cannot remove the classroom creator. The creator must always remain as a teacher.',
      })
    }

    // Remove teacher from classroom
    classroom.teachers.splice(teacherIndex, 1)
    const updatedClassroom = await classroom.save()

    // Populate teachers for response
    await updatedClassroom.populate('teachers', 'firstName lastName email')

    res.status(200).json({
      success: true,
      message: 'Co-teacher removed successfully',
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
    console.error('Remove co-teacher error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Get students enrolled in a classroom
// @route   GET /api/classroom/:id/students
// @access  Private (Teacher only)
export const getClassroomStudents = async (req, res) => {
  try {
    // Check if user is a teacher
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only teachers can access this endpoint.',
      })
    }

    const { status = 'active' } = req.query // active | left | all
    const classroomId = req.params.id

    const classroom = await Classroom.findById(classroomId)

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: 'Classroom not found',
      })
    }

    // Check if user is a teacher of this classroom
    if (!classroom.teachers.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a teacher of this classroom.',
      })
    }

    // Find all student profiles that have this classroom in their classesJoined array
    const studentProfiles = await StudentProfile.find({
      'classesJoined.classroomId': classroomId,
    }).populate('userId', 'firstName lastName email profileImage')

    // Get all completed sessions for this classroom
    const completedSessions = await AttendanceSession.find({
      classroomId: classroomId,
      endedAt: { $ne: null },
    }).select('_id')

    const sessionIds = completedSessions.map((session) => session._id)

    // Format and filter students
    const students = []

    for (const profile of studentProfiles) {
      const enrollment = profile.classesJoined.find(
        (c) => c.classroomId.toString() === classroomId.toString()
      )

      if (!enrollment) continue

      // Filter by status
      if (status === 'active' && enrollment.status !== 'ACTIVE') continue
      if (status === 'left' && enrollment.status !== 'LEFT') continue
      // 'all' shows everything

      // Calculate attendance statistics for this student
      let attendancePercentage = 0
      let totalSessions = 0
      let presentCount = 0

      if (sessionIds.length > 0) {
        // Count total sessions this student could have attended
        // (sessions that occurred after they joined and before they left if applicable)
        const relevantSessions = await AttendanceSession.find({
          _id: { $in: sessionIds },
          createdAt: { $gte: enrollment.joinedAt },
          ...(enrollment.leftAt && { createdAt: { $lte: enrollment.leftAt } }),
        })

        totalSessions = relevantSessions.length

        if (totalSessions > 0) {
          // Count how many sessions the student was marked present
          // Use profile.userId because AttendanceRecord.studentId references User model
          const attendanceRecords = await AttendanceRecord.find({
            classroomId: classroomId,
            studentId: profile.userId,
            sessionId: { $in: relevantSessions.map((s) => s._id) },
            status: 'PRESENT',
          })

          presentCount = attendanceRecords.length
          attendancePercentage = Math.round(
            (presentCount / totalSessions) * 100
          )
        }
      }

      students.push({
        studentId: profile.studentId,
        userId: profile.userId,
        enrollmentStatus: enrollment.status,
        joinedAt: enrollment.joinedAt,
        leftAt: enrollment.leftAt,
        attendanceStats: {
          totalSessions,
          presentCount,
          attendancePercentage,
        },
      })
    }

    // Sort: Active first, then by join date
    students.sort((a, b) => {
      if (a.enrollmentStatus !== b.enrollmentStatus) {
        return a.enrollmentStatus === 'ACTIVE' ? -1 : 1
      }
      return new Date(b.joinedAt) - new Date(a.joinedAt)
    })

    res.status(200).json({
      success: true,
      data: { students },
    })
  } catch (error) {
    console.error('Get classroom students error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}
