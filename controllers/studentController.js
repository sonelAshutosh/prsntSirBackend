import StudentProfile from '../models/studentProfile.js'
import Classroom from '../models/classroom.js'
import User from '../models/user.js'
import AttendanceRecord from '../models/attendanceRecord.js'
import QRCode from 'qrcode'

// @desc    Get or create student profile with QR code
// @route   GET /api/student/profile
// @access  Private (Student only)
export const getStudentProfile = async (req, res) => {
  try {
    // Check if user is a student
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only students can access this endpoint.',
      })
    }

    // Find or create student profile
    let studentProfile = await StudentProfile.findOne({ userId: req.user._id })

    if (!studentProfile) {
      // Create new student profile
      studentProfile = await StudentProfile.create({
        userId: req.user._id,
        studentId: `STU${Date.now()}`, // Generate unique student ID
        classesJoined: [],
      })
    }

    // Generate QR code if it doesn't exist
    if (!studentProfile.qrCode) {
      // QR code contains ONLY the studentId for simplicity and reliability
      const qrData = studentProfile.studentId

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M', // Medium error correction is sufficient
        type: 'image/png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })

      studentProfile.qrCode = qrCodeDataURL
      await studentProfile.save()
    }

    res.status(200).json({
      success: true,
      data: {
        studentProfile: {
          id: studentProfile._id,
          studentId: studentProfile.studentId,
          qrCode: studentProfile.qrCode,
          classesJoined: studentProfile.classesJoined,
          createdAt: studentProfile.createdAt,
          updatedAt: studentProfile.updatedAt,
        },
      },
    })
  } catch (error) {
    console.error('Get student profile error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Regenerate student QR code
// @route   POST /api/student/regenerate-qr
// @access  Private (Student only)
export const regenerateQRCode = async (req, res) => {
  try {
    // Check if user is a student
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only students can access this endpoint.',
      })
    }

    const studentProfile = await StudentProfile.findOne({
      userId: req.user._id,
    })

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found',
      })
    }

    // Generate new QR code with only studentId
    const qrData = studentProfile.studentId

    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })

    studentProfile.qrCode = qrCodeDataURL
    await studentProfile.save()

    res.status(200).json({
      success: true,
      message: 'QR code regenerated successfully',
      data: {
        qrCode: studentProfile.qrCode,
      },
    })
  } catch (error) {
    console.error('Regenerate QR code error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Join a classroom using class code
// @route   POST /api/student/join-class
// @access  Private (Student only)
export const joinClassroom = async (req, res) => {
  try {
    // Check if user is a student
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only students can join classrooms.',
      })
    }

    const { classCode } = req.body

    // Validate class code
    if (!classCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a class code',
      })
    }

    // Find classroom by code
    const classroom = await Classroom.findOne({ code: classCode.toUpperCase() })

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: 'Invalid class code. Please check and try again.',
      })
    }

    // Find or create student profile
    let studentProfile = await StudentProfile.findOne({ userId: req.user._id })

    if (!studentProfile) {
      studentProfile = await StudentProfile.create({
        userId: req.user._id,
        studentId: `STU${Date.now()}`,
        classesJoined: [],
      })
    }

    // Check if student has an existing enrollment (active or left)
    const existingEnrollment = studentProfile.classesJoined.find(
      (c) => c.classroomId.toString() === classroom._id.toString()
    )

    if (existingEnrollment) {
      if (existingEnrollment.status === 'ACTIVE') {
        return res.status(400).json({
          success: false,
          message: 'You are already enrolled in this class',
        })
      }

      // Re-activate if previously left
      existingEnrollment.status = 'ACTIVE'
      existingEnrollment.joinedAt = new Date()
      existingEnrollment.leftAt = null

      // Restore (undelete) previous attendance records
      await AttendanceRecord.updateMany(
        {
          studentId: req.user._id,
          classroomId: classroom._id,
          deletedAt: { $ne: null }, // Only restore deleted records
        },
        {
          $set: { deletedAt: null },
        }
      )
    } else {
      // New enrollment
      studentProfile.classesJoined.push({
        classroomId: classroom._id,
        status: 'ACTIVE',
        joinedAt: new Date(),
        leftAt: null,
      })
    }

    await studentProfile.save()

    res.status(200).json({
      success: true,
      message: `Successfully joined ${classroom.name}`,
      data: {
        classroom: {
          id: classroom._id,
          name: classroom.name,
          subject: classroom.subject,
          code: classroom.code,
        },
      },
    })
  } catch (error) {
    console.error('Join classroom error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Leave a classroom
// @route   POST /api/student/leave-classroom/:classroomId
// @access  Private (Student only)
export const leaveClassroom = async (req, res) => {
  try {
    // Check if user is a student
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only students can access this endpoint.',
      })
    }

    const { classroomId } = req.params

    // Find student profile
    const studentProfile = await StudentProfile.findOne({
      userId: req.user._id,
    })

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found',
      })
    }

    // Find the enrollment
    const enrollment = studentProfile.classesJoined.find(
      (c) => c.classroomId.toString() === classroomId.toString()
    )

    if (!enrollment) {
      return res.status(400).json({
        success: false,
        message: 'You are not enrolled in this classroom',
      })
    }

    if (enrollment.status === 'LEFT') {
      return res.status(400).json({
        success: false,
        message: 'You have already left this classroom',
      })
    }

    // Update status to LEFT
    enrollment.status = 'LEFT'
    enrollment.leftAt = new Date()

    await studentProfile.save()

    // Soft delete all attendance records for this student in this classroom
    await AttendanceRecord.updateMany(
      {
        studentId: req.user._id,
        classroomId: classroomId,
        deletedAt: null, // Only update non-deleted records
      },
      {
        $set: { deletedAt: new Date() },
      }
    )

    res.status(200).json({
      success: true,
      message: 'Successfully left the classroom',
      data: { studentProfile },
    })
  } catch (error) {
    console.error('Leave classroom error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}

// @desc    Get student's joined classrooms
// @route   GET /api/student/my-classes
// @access  Private (Student only)
export const getStudentClassrooms = async (req, res) => {
  try {
    // Check if user is a student
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only students can access this endpoint.',
      })
    }

    const studentProfile = await StudentProfile.findOne({
      userId: req.user._id,
    }).populate({
      path: 'classesJoined.classroomId',
      populate: {
        path: 'teachers',
        select: 'firstName lastName email profileImage',
      },
    })

    if (!studentProfile) {
      return res.status(200).json({
        success: true,
        data: {
          classrooms: [],
        },
      })
    }

    // Filter to show only ACTIVE classes
    const activeClasses = studentProfile.classesJoined
      .filter((c) => c.status === 'ACTIVE')
      .map((enrollment) => ({
        id: enrollment.classroomId._id,
        name: enrollment.classroomId.name,
        subject: enrollment.classroomId.subject,
        code: enrollment.classroomId.code,
        teachers: enrollment.classroomId.teachers,
        joinedAt: enrollment.joinedAt,
        createdAt: enrollment.classroomId.createdAt,
        updatedAt: enrollment.classroomId.updatedAt,
      }))

    res.status(200).json({
      success: true,
      data: {
        classrooms: activeClasses,
      },
    })
  } catch (error) {
    console.error('Get student classrooms error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}
