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

    const { classroomId, mode, topic } = req.body

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

    // Check if there's already an active session for this classroom
    const activeSession = await AttendanceSession.findOne({
      classroomId,
      endedAt: { $exists: false }, // Session not ended yet
    })

    if (activeSession) {
      return res.status(400).json({
        success: false,
        message: 'An active session already exists for this classroom',
        data: {
          activeSession: {
            id: activeSession._id,
            classroomId: activeSession.classroomId,
            mode: activeSession.mode,
            topic: activeSession.topic,
            createdAt: activeSession.createdAt,
          },
        },
      })
    }

    // Create attendance session
    const session = await AttendanceSession.create({
      classroomId,
      createdByUserId: req.user._id,
      mode: mode || 'MANUAL',
      topic: topic || 'General Class',
    })

    res.status(201).json({
      success: true,
      message: 'Attendance session created successfully',
      data: {
        session: {
          id: session._id,
          classroomId: session.classroomId,
          mode: session.mode,
          topic: session.topic,
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
        session: {
          id: session._id,
          topic: session.topic,
          mode: session.mode,
          createdAt: session.createdAt,
        },
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

// @desc    Get all sessions for a classroom
// @route   GET /api/attendance/classroom/:classroomId/sessions
// @access  Private (Teacher only)
export const getClassroomSessions = async (req, res) => {
  try {
    const { classroomId } = req.params

    // Verify teacher has access
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
        message: 'Access denied',
      })
    }

    // Get sessions (only completed sessions)
    const sessions = await AttendanceSession.find({
      classroomId,
      endedAt: { $exists: true },
    })
      .sort({ createdAt: -1 })
      .lean()

    // Enrich sessions with stats
    const sessionsWithStats = await Promise.all(
      sessions.map(async (session) => {
        const records = await AttendanceRecord.find({ sessionId: session._id })
        const totalStudents = await StudentProfile.countDocuments({
          classesJoined: classroomId,
        })
        const presentCount = records.filter(
          (r) => r.status === 'PRESENT'
        ).length

        return {
          id: session._id,
          date: session.createdAt,
          type: session.mode,
          status: session.endedAt ? 'completed' : 'active',
          totalStudents,
          presentStudents: presentCount,
          topic:
            session.topic ||
            `Session ${new Date(session.createdAt).toLocaleDateString()}`,
        }
      })
    )

    res.status(200).json({
      success: true,
      data: {
        sessions: sessionsWithStats,
      },
    })
  } catch (error) {
    console.error('Get classroom sessions error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Get student attendance history for a classroom
// @route   GET /api/attendance/classroom/:classroomId/student
// @access  Private (Student only)
export const getStudentAttendanceHistory = async (req, res) => {
  try {
    const { classroomId } = req.params
    const studentId = req.user._id

    // Verify student is enrolled
    const studentProfile = await StudentProfile.findOne({
      userId: studentId,
      classesJoined: classroomId,
    })

    if (!studentProfile) {
      return res.status(403).json({
        success: false,
        message: 'You are not enrolled in this classroom',
      })
    }

    // Get all sessions for this classroom
    const sessions = await AttendanceSession.find({
      classroomId,
      endedAt: { $exists: true }, // Only completed sessions
    })
      .sort({ createdAt: -1 })
      .lean()

    // Get attendance records for this student
    const records = await AttendanceRecord.find({
      studentId: studentId,
      classroomId,
    })

    // Map sessions to include student status
    const history = sessions.map((session) => {
      const record = records.find(
        (r) => r.sessionId.toString() === session._id.toString()
      )
      return {
        id: session._id,
        date: session.createdAt,
        topic:
          session.topic ||
          `Session ${new Date(session.createdAt).toLocaleDateString()}`,
        status: record ? record.status.toLowerCase() : 'absent', // Default to absent if no record found for a completed session
        markedAt: record
          ? new Date(record.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : null,
      }
    })

    res.status(200).json({
      success: true,
      data: {
        history,
      },
    })
  } catch (error) {
    console.error('Get student history error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Mark attendance by scanning student QR code
// @route   POST /api/attendance/session/:sessionId/scan-qr
// @access  Private (Teacher only)
export const markAttendanceByQR = async (req, res) => {
  try {
    const { sessionId } = req.params
    const { qrData } = req.body

    // Validate
    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: 'Please provide QR code data',
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

    // Check if session is still active (not ended)
    if (session.endedAt) {
      return res.status(400).json({
        success: false,
        message: 'This session has already ended',
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

    // Find student by QR data (studentId from QR code)
    const studentProfile = await StudentProfile.findOne({ studentId: qrData })
    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: 'Student not found. Invalid QR code.',
      })
    }

    // Verify student is enrolled in this classroom
    const student = await User.findById(studentProfile.userId)
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student user not found',
      })
    }

    // Check enrollment in either User.enrolledClasses or StudentProfile.classesJoined
    const isEnrolledInUser =
      student.enrolledClasses &&
      student.enrolledClasses.includes(session.classroomId)
    const isEnrolledInProfile =
      studentProfile.classesJoined &&
      studentProfile.classesJoined.includes(session.classroomId)

    if (!isEnrolledInUser && !isEnrolledInProfile) {
      return res.status(400).json({
        success: false,
        message: 'Student is not enrolled in this classroom',
      })
    }

    // Check if attendance already marked
    const existingRecord = await AttendanceRecord.findOne({
      studentId: studentProfile.userId,
      sessionId: session._id,
    })

    if (existingRecord) {
      return res.status(400).json({
        success: false,
        message: `Attendance already marked as ${existingRecord.status} for this student`,
        data: {
          student: {
            name: `${student.firstName} ${student.lastName}`,
            studentId: studentProfile.studentId,
            status: existingRecord.status,
          },
        },
      })
    }

    // Create attendance record
    const record = await AttendanceRecord.create({
      studentId: studentProfile.userId,
      sessionId: session._id,
      classroomId: session.classroomId,
      status: 'PRESENT',
      markedBy: req.user._id,
    })

    res.status(200).json({
      success: true,
      message: 'Attendance marked successfully',
      data: {
        student: {
          id: student._id,
          name: `${student.firstName} ${student.lastName}`,
          studentId: studentProfile.studentId,
          email: student.email,
        },
        record: {
          id: record._id,
          status: record.status,
          markedAt: record.createdAt,
        },
      },
    })
  } catch (error) {
    console.error('Mark attendance by QR error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Get active session for a classroom
// @route   GET /api/attendance/classroom/:classroomId/active-session
// @access  Private (Teacher only)
export const getActiveSession = async (req, res) => {
  try {
    const { classroomId } = req.params

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
        message: 'Access denied',
      })
    }

    // Find active session (not ended)
    const activeSession = await AttendanceSession.findOne({
      classroomId,
      endedAt: { $exists: false },
    })

    if (!activeSession) {
      return res.status(200).json({
        success: true,
        data: {
          activeSession: null,
        },
      })
    }

    res.status(200).json({
      success: true,
      data: {
        activeSession: {
          id: activeSession._id,
          classroomId: activeSession.classroomId,
          mode: activeSession.mode,
          topic: activeSession.topic,
          createdAt: activeSession.createdAt,
        },
      },
    })
  } catch (error) {
    console.error('Get active session error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}
