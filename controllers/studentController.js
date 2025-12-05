import StudentProfile from '../models/studentProfile.js'
import Classroom from '../models/classroom.js'
import User from '../models/user.js'
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

    // Check if student is already in the class
    if (studentProfile.classesJoined.includes(classroom._id)) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this class',
      })
    }

    // Add classroom to student's joined classes
    studentProfile.classesJoined.push(classroom._id)
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
      path: 'classesJoined',
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

    res.status(200).json({
      success: true,
      data: {
        classrooms: studentProfile.classesJoined.map((classroom) => ({
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
    console.error('Get student classrooms error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    })
  }
}
