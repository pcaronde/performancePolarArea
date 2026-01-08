const Assessment = require('../models/Assessment');
const csvParser = require('csv-parser');
const { format } = require('fast-csv');
const { Readable } = require('stream');

/**
 * Get all assessments for logged-in user
 * GET /api/assessments
 * Query params: page, limit, employeeName, startDate, endDate
 */
async function getAssessments(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = { userId: req.userId };

    if (req.query.employeeName) {
      filter.employeeName = { $regex: req.query.employeeName, $options: 'i' };
    }

    if (req.query.startDate || req.query.endDate) {
      filter.assessmentDate = {};
      if (req.query.startDate) {
        filter.assessmentDate.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.assessmentDate.$lte = new Date(req.query.endDate);
      }
    }

    // Get total count for pagination
    const total = await Assessment.countDocuments(filter);

    // Get assessments
    const assessments = await Assessment.find(filter)
      .sort({ assessmentDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      assessments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get assessments error:', error);
    res.status(500).json({ message: 'Failed to retrieve assessments' });
  }
}

/**
 * Get single assessment by ID
 * GET /api/assessments/:id
 */
async function getAssessment(req, res) {
  try {
    const assessment = await Assessment.findOne({
      _id: req.params.id,
      userId: req.userId // Ensure user can only access their own assessments
    });

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    res.json(assessment);

  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({ message: 'Failed to retrieve assessment' });
  }
}

/**
 * Create new assessment
 * POST /api/assessments
 */
async function createAssessment(req, res) {
  try {
    const { employeeName, assessmentDate, metrics } = req.body;

    const assessment = new Assessment({
      userId: req.userId,
      employeeName,
      assessmentDate: assessmentDate || new Date(),
      metrics
    });

    await assessment.save();

    res.status(201).json({
      message: 'Assessment created successfully',
      assessment
    });

  } catch (error) {
    console.error('Create assessment error:', error);
    res.status(500).json({ message: 'Failed to create assessment' });
  }
}

/**
 * Update existing assessment
 * PUT /api/assessments/:id
 */
async function updateAssessment(req, res) {
  try {
    const { employeeName, assessmentDate, metrics } = req.body;

    const assessment = await Assessment.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    // Update fields
    if (employeeName !== undefined) assessment.employeeName = employeeName;
    if (assessmentDate !== undefined) assessment.assessmentDate = assessmentDate;
    if (metrics !== undefined) assessment.metrics = metrics;

    await assessment.save();

    res.json({
      message: 'Assessment updated successfully',
      assessment
    });

  } catch (error) {
    console.error('Update assessment error:', error);
    res.status(500).json({ message: 'Failed to update assessment' });
  }
}

/**
 * Delete assessment
 * DELETE /api/assessments/:id
 */
async function deleteAssessment(req, res) {
  try {
    const assessment = await Assessment.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    res.json({ message: 'Assessment deleted successfully' });

  } catch (error) {
    console.error('Delete assessment error:', error);
    res.status(500).json({ message: 'Failed to delete assessment' });
  }
}

/**
 * Import assessments from CSV
 * POST /api/assessments/import-csv
 * Content-Type: multipart/form-data
 */
async function importFromCSV(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const employeeName = req.body.employeeName || 'Unknown';
    const results = [];
    const errors = [];

    // Parse CSV
    const csvData = req.file.buffer.toString();
    const lines = csvData.trim().split('\n');

    // Validate header
    if (lines.length < 2) {
      return res.status(400).json({ message: 'CSV file is empty or invalid' });
    }

    const header = lines[0].toLowerCase();
    if (!header.includes('categories') || !header.includes('ratings')) {
      return res.status(400).json({
        message: 'Invalid CSV format. Expected "Categories,Ratings" header'
      });
    }

    // Parse metrics from CSV
    const metrics = {};
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [category, rating] = line.split(',').map(s => s.trim());
      const value = parseInt(rating);

      if (isNaN(value) || value < 0 || value > 5) {
        errors.push(`Invalid rating for ${category}: ${rating}`);
        continue;
      }

      metrics[category] = value;
    }

    // Validate that we have all 19 metrics
    const requiredMetrics = [
      'sharedVision', 'strategy', 'businessAlignment', 'customerFocus',
      'crossFunctionalTeams', 'clarityInPriorities', 'acceptanceCriteria', 'enablingFocus', 'engagement',
      'feedback', 'enablingAutonomy', 'changeAndAmbiguity', 'desiredCulture', 'workAutonomously',
      'stakeholders', 'teamAttrition', 'teams', 'developingPeople', 'subordinatesForSuccess'
    ];

    const missingMetrics = requiredMetrics.filter(metric => metrics[metric] === undefined);
    if (missingMetrics.length > 0) {
      return res.status(400).json({
        message: 'Missing required metrics',
        missing: missingMetrics
      });
    }

    // Create assessment
    const assessment = new Assessment({
      userId: req.userId,
      employeeName,
      assessmentDate: new Date(),
      metrics
    });

    await assessment.save();

    res.status(201).json({
      message: 'CSV imported successfully',
      assessment,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Import CSV error:', error);
    res.status(500).json({ message: 'Failed to import CSV' });
  }
}

/**
 * Export assessments to CSV
 * GET /api/assessments/export-csv
 * Query params: ids (comma-separated) OR employeeName, startDate, endDate
 */
async function exportToCSV(req, res) {
  try {
    let assessments;

    // Export specific assessments by IDs
    if (req.query.ids) {
      const ids = req.query.ids.split(',');
      assessments = await Assessment.find({
        _id: { $in: ids },
        userId: req.userId
      });
    }
    // Export filtered assessments
    else {
      const filter = { userId: req.userId };

      if (req.query.employeeName) {
        filter.employeeName = { $regex: req.query.employeeName, $options: 'i' };
      }

      if (req.query.startDate || req.query.endDate) {
        filter.assessmentDate = {};
        if (req.query.startDate) {
          filter.assessmentDate.$gte = new Date(req.query.startDate);
        }
        if (req.query.endDate) {
          filter.assessmentDate.$lte = new Date(req.query.endDate);
        }
      }

      assessments = await Assessment.find(filter).sort({ assessmentDate: -1 });
    }

    if (assessments.length === 0) {
      return res.status(404).json({ message: 'No assessments found' });
    }

    // If single assessment, use simple format
    if (assessments.length === 1) {
      const assessment = assessments[0];
      let csv = 'Categories,Ratings\n';

      Object.entries(assessment.metrics).forEach(([key, value]) => {
        csv += `${key},${value}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${assessment.employeeName}_assessment_${assessment.assessmentDate.toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    }
    // Multiple assessments, include employee name and date
    else {
      let csv = 'Employee Name,Assessment Date,';
      const metricKeys = Object.keys(assessments[0].metrics);
      csv += metricKeys.join(',') + '\n';

      assessments.forEach(assessment => {
        const date = assessment.assessmentDate.toISOString().split('T')[0];
        const values = metricKeys.map(key => assessment.metrics[key]);
        csv += `"${assessment.employeeName}",${date},${values.join(',')}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="assessments_export_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    }

  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ message: 'Failed to export CSV' });
  }
}

module.exports = {
  getAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  importFromCSV,
  exportToCSV
};
