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

    // Create attendance records for all ACTIVE students
    const studentProfiles = await StudentProfile.find({
      'classesJoined.classroomId': classroomId,
      'classesJoined.status': 'ACTIVE',
    })

    // Create attendance records with default status ABSENT
    const attendanceRecords = studentProfiles.map((profile) => ({
      studentId: profile.userId,
      sessionId: session._id,
      classroomId: classroomId,
      status: 'ABSENT', // Default to absent
    }))

    if (attendanceRecords.length > 0) {
      await AttendanceRecord.insertMany(attendanceRecords)
    }

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

    // Get all attendance records for this session (exclude deleted)
    const attendanceRecords = await AttendanceRecord.find({
      sessionId: session._id,
      deletedAt: null,
    }).populate('studentId', 'firstName lastName email profileImage')

    // Get student profiles to get studentId
    const studentIds = attendanceRecords.map((r) => r.studentId._id)
    const studentProfiles = await StudentProfile.find({
      userId: { $in: studentIds },
    })

    // Create a map of userId to studentId
    const userIdToStudentId = {}
    studentProfiles.forEach((profile) => {
      userIdToStudentId[profile.userId.toString()] = profile.studentId
    })

    // Map records to student data with attendance status
    const students = attendanceRecords.map((record) => ({
      id: record.studentId._id,
      firstName: record.studentId.firstName,
      lastName: record.studentId.lastName,
      email: record.studentId.email,
      profileImage: record.studentId.profileImage,
      studentId: userIdToStudentId[record.studentId._id.toString()] || 'N/A',
      attendanceStatus: record.status, // PRESENT or ABSENT
      attendanceRecordId: record._id,
    }))

    res.status(200).json({
      success: true,
      data: {
        session: {
          id: session._id,
          topic: session.topic,
          mode: session.mode,
          createdAt: session.createdAt,
        },
        students,
        totalStudents: students.length,
        unmarkedCount: students.filter((s) => s.attendanceStatus === 'ABSENT')
          .length,
        markedCount: students.filter((s) => s.attendanceStatus === 'PRESENT')
          .length,
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

// @desc    Get marked students for a session
// @route   GET /api/attendance/session/:sessionId/marked
// @access  Private (Teacher only)
export const getMarkedStudents = async (req, res) => {
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

    // Get attendance records for this session (exclude deleted)
    const records = await AttendanceRecord.find({
      sessionId: session._id,
      status: 'PRESENT',
      deletedAt: null,
    }).populate('studentId', 'firstName lastName email profileImage')

    // Get student profiles to include studentId
    const markedStudents = await Promise.all(
      records.map(async (record) => {
        const studentProfile = await StudentProfile.findOne({
          userId: record.studentId._id,
        })

        return {
          id: record.studentId._id,
          name: `${record.studentId.firstName} ${record.studentId.lastName}`,
          studentId: studentProfile?.studentId || 'N/A',
          email: record.studentId.email,
          scannedAt: new Date(record.createdAt).toLocaleTimeString(),
          status: record.status,
        }
      })
    )

    res.status(200).json({
      success: true,
      data: {
        markedStudents,
      },
    })
  } catch (error) {
    console.error('Get marked students error:', error)
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
    const records = await AttendanceRecord.find({
      sessionId: session._id,
      deletedAt: null,
    })
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
        const records = await AttendanceRecord.find({
          sessionId: session._id,
          deletedAt: null,
        })

        // Total students = current ACTIVE students in classroom
        // This shows attendance as a percentage of current enrollment
        const totalStudents = await StudentProfile.countDocuments({
          'classesJoined.classroomId': classroomId,
          'classesJoined.status': 'ACTIVE',
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

    // Verify student is enrolled (with new schema)
    const studentProfile = await StudentProfile.findOne({
      userId: studentId,
      'classesJoined.classroomId': classroomId,
    })

    if (!studentProfile) {
      return res.status(403).json({
        success: false,
        message: 'You are not enrolled in this classroom',
      })
    }

    // Check if student has left the classroom
    const enrollment = studentProfile.classesJoined.find(
      (c) => c.classroomId.toString() === classroomId.toString()
    )

    if (enrollment && enrollment.status === 'LEFT') {
      return res.status(403).json({
        success: false,
        message: 'You have left this classroom',
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
      deletedAt: null,
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

    // Check enrollment with new schema
    const enrollment = studentProfile.classesJoined?.find(
      (c) => c.classroomId.toString() === session.classroomId.toString()
    )

    if (!enrollment || enrollment.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Student is not enrolled in this classroom or has left',
      })
    }

    // Check if attendance record exists
    const existingRecord = await AttendanceRecord.findOne({
      studentId: studentProfile.userId,
      sessionId: session._id,
      deletedAt: null,
    })

    if (existingRecord) {
      // If already marked PRESENT, don't allow re-scanning
      if (existingRecord.status === 'PRESENT') {
        return res.status(400).json({
          success: false,
          message: 'Attendance already marked as PRESENT for this student',
          data: {
            student: {
              name: `${student.firstName} ${student.lastName}`,
              studentId: studentProfile.studentId,
              status: existingRecord.status,
            },
          },
        })
      }

      // Update ABSENT → PRESENT
      existingRecord.status = 'PRESENT'
      existingRecord.markedBy = req.user._id
      await existingRecord.save()

      return res.status(200).json({
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
            id: existingRecord._id,
            status: existingRecord.status,
            markedAt: existingRecord.updatedAt,
          },
        },
      })
    }

    // Create attendance record (shouldn't happen if session creation works correctly)
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
