import express from 'express'
import {
  getProfile,
  updateProfile,
  updateProfilePicture,
  changePassword,
  deleteAccount,
} from '../controllers/userController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

// All routes are protected (require authentication)
router.use(protect)

// GET /api/user/profile - Get current user profile
router.get('/profile', getProfile)

// PUT /api/user/profile - Update user profile
router.put('/profile', updateProfile)

// PUT /api/user/profile-picture - Update profile picture
router.put('/profile-picture', updateProfilePicture)

// PUT /api/user/change-password - Change password
router.put('/change-password', changePassword)

// DELETE /api/user/account - Delete account
router.delete('/account', deleteAccount)

export default router
