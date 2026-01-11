const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  register,
  login,
  getCurrentUser,
  getAuthConfig,
  logout
} = require('../controllers/authController');
const {
  validateRegistration,
  validateLogin
} = require('../middleware/validation');
const { authenticateToken } = require('../middleware/authMiddleware');

// Rate limiter for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * GET /api/auth/config
 * Get authentication configuration (public endpoint)
 * Returns: { allowRegistration }
 */
router.get('/config', getAuthConfig);

/**
 * POST /api/auth/register
 * Register a new user
 * Body: { email, password, firstName, lastName }
 */
router.post('/register', authLimiter, validateRegistration, register);

/**
 * POST /api/auth/login
 * Login with email and password
 * Body: { email, password }
 * Returns: { token, user }
 */
router.post('/login', authLimiter, validateLogin, login);

/**
 * GET /api/auth/me
 * Get current logged-in user info
 * Requires: Authorization header with Bearer token
 * Returns: { user }
 */
router.get('/me', authenticateToken, getCurrentUser);

/**
 * POST /api/auth/logout
 * Logout (client-side token removal)
 * Requires: Authorization header with Bearer token
 */
router.post('/logout', authenticateToken, logout);

module.exports = router;
