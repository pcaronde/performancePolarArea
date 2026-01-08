const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  importFromCSV,
  exportToCSV
} = require('../controllers/assessmentController');
const { validateAssessment } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/authMiddleware');

// Configure multer for CSV file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/assessments
 * Get all assessments for logged-in user
 * Query params: page, limit, employeeName, startDate, endDate
 * Returns: { assessments[], pagination }
 */
router.get('/', getAssessments);

/**
 * GET /api/assessments/export-csv
 * Export assessments to CSV
 * Query params: ids (comma-separated) OR employeeName, startDate, endDate
 * Returns: CSV file download
 */
router.get('/export-csv', exportToCSV);

/**
 * GET /api/assessments/:id
 * Get single assessment by ID
 * Returns: Assessment object
 */
router.get('/:id', getAssessment);

/**
 * POST /api/assessments
 * Create new assessment
 * Body: { employeeName, assessmentDate?, metrics }
 * Returns: { assessment }
 */
router.post('/', validateAssessment, createAssessment);

/**
 * POST /api/assessments/import-csv
 * Import assessment from CSV file
 * Content-Type: multipart/form-data
 * Body: CSV file + employeeName
 * Returns: { assessment, errors? }
 */
router.post('/import-csv', upload.single('csvFile'), importFromCSV);

/**
 * PUT /api/assessments/:id
 * Update existing assessment
 * Body: { employeeName?, assessmentDate?, metrics? }
 * Returns: { assessment }
 */
router.put('/:id', validateAssessment, updateAssessment);

/**
 * DELETE /api/assessments/:id
 * Delete assessment
 * Returns: { message }
 */
router.delete('/:id', deleteAssessment);

module.exports = router;
