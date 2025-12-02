import AttendanceSession from '../models/attendanceSessions.js'
import AttendanceRecord from '../models/attendanceRecord.js'
import Classroom from '../models/classroom.js'
import StudentProfile from '../models/studentProfile.js'
import User from '../models/user.js'

// @desc    Create a new attendance session
// @route   POST /api/attendance/session/create
// @access  Private (Teacher only)
export const createAttendanceSession = async (req, res) => {
  try {
    // Check if user is a teacher
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only teachers can create attendance sessions.',
      })
    }

    const { classroomId, mode } = req.body

    // Validate required fields
    if (!classroomId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide classroom ID',
      })
    }

    // Verify classroom exists and teacher has access
    const classroom = await Classroom.findById(classroomId)
    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: 'Classroom not found',
      })
    }

    if (!classroom.teachers.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a teacher of this classroom',
      })
    }

    // Create attendance session
    const session = await AttendanceSession.create({
      classroomId,
      createdByUserId: req.user._id,
      mode: mode || 'MANUAL',
    })

    res.status(201).json({
      success: true,
      message: 'Attendance session created successfully',
      data: {
        session: {
          id: session._id,
          classroomId: session.classroomId,
          mode: session.mode,
          createdAt: session.createdAt,
        },
      },
    })
  } catch (error) {
    console.error('Create attendance session error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Get students for attendance session
// @route   GET /api/attendance/session/:sessionId/students
// @access  Private (Teacher only)
export const getSessionStudents = async (req, res) => {
  try {
    const { sessionId } = req.params

    // Get session
    const session = await AttendanceSession.findById(sessionId)
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      })
    }

    // Verify teacher has access
    const classroom = await Classroom.findById(session.classroomId)
    if (!classroom.teachers.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      })
    }

    // Get all students enrolled in this classroom
    const studentProfiles = await StudentProfile.find({
      classesJoined: session.classroomId,
    }).populate('userId', 'firstName lastName email profileImage')

    // Get existing attendance records for this session
    const existingRecords = await AttendanceRecord.find({
      sessionId: session._id,
    })

    const markedStudentIds = existingRecords.map((r) => r.studentId.toString())

    // Filter out already marked students
    const unmarkedStudents = studentProfiles.filter(
      (profile) => !markedStudentIds.includes(profile.userId._id.toString())
    )

    res.status(200).json({
      success: true,
      data: {
        students: unmarkedStudents.map((profile) => ({
          id: profile.userId._id,
          firstName: profile.userId.firstName,
          lastName: profile.userId.lastName,
          email: profile.userId.email,
          profileImage: profile.userId.profileImage,
          studentId: profile.studentId,
        })),
        totalStudents: studentProfiles.length,
        unmarkedCount: unmarkedStudents.length,
        markedCount: markedStudentIds.length,
      },
    })
  } catch (error) {
    console.error('Get session students error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Mark student attendance
// @route   POST /api/attendance/session/:sessionId/mark
// @access  Private (Teacher only)
export const markAttendance = async (req, res) => {
  try {
    const { sessionId } = req.params
    const { studentId, status } = req.body

    // Validate
    if (!studentId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide student ID and status',
      })
    }

    if (!['PRESENT', 'ABSENT'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be PRESENT or ABSENT',
      })
    }

    // Get session
    const session = await AttendanceSession.findById(sessionId)
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      })
    }

    // Verify teacher has access
    const classroom = await Classroom.findById(session.classroomId)
    if (!classroom.teachers.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      })
    }

    // Create or update attendance record
    const record = await AttendanceRecord.findOneAndUpdate(
      {
        studentId,
        sessionId: session._id,
      },
      {
        studentId,
        sessionId: session._id,
        classroomId: session.classroomId,
        status,
      },
      {
        upsert: true,
        new: true,
      }
    )

    res.status(200).json({
      success: true,
      message: `Student marked ${status.toLowerCase()}`,
      data: {
        record: {
          id: record._id,
          studentId: record.studentId,
          status: record.status,
          createdAt: record.createdAt,
        },
      },
    })
  } catch (error) {
    console.error('Mark attendance error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    End attendance session
// @route   POST /api/attendance/session/:sessionId/end
// @access  Private (Teacher only)
export const endAttendanceSession = async (req, res) => {
  try {
    const { sessionId } = req.params

    // Get session
    const session = await AttendanceSession.findById(sessionId)
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      })
    }

    // Verify teacher has access
    const classroom = await Classroom.findById(session.classroomId)
    if (!classroom.teachers.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      })
    }

    // Update session
    session.endedAt = new Date()
    await session.save()

    // Get session summary
    const records = await AttendanceRecord.find({ sessionId: session._id })
    const presentCount = records.filter((r) => r.status === 'PRESENT').length
    const absentCount = records.filter((r) => r.status === 'ABSENT').length

    res.status(200).json({
      success: true,
      message: 'Session ended successfully',
      data: {
        session: {
          id: session._id,
          endedAt: session.endedAt,
          summary: {
            total: records.length,
            present: presentCount,
            absent: absentCount,
          },
        },
      },
    })
  } catch (error) {
    console.error('End session error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}
