const mongoose = require('mongoose');

/**
 * Assessment Schema - 19 metrics across 4 themes
 */
const assessmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  employeeName: {
    type: String,
    required: [true, 'Employee name is required'],
    trim: true,
    index: true
  },
  assessmentDate: {
    type: Date,
    default: Date.now,
    index: true
  },

  // All 19 metrics (0-5 rating scale)
  metrics: {
    // Strategic Vision (4 metrics)
    sharedVision: {
      type: Number,
      required: true,
      min: [0, 'Rating must be at least 0'],
      max: [5, 'Rating must be at most 5']
    },
    strategy: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    businessAlignment: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    customerFocus: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },

    // Focus and Engagement (5 metrics)
    crossFunctionalTeams: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    clarityInPriorities: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    acceptanceCriteria: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    enablingFocus: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    engagement: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },

    // Autonomy and Change (5 metrics)
    feedback: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    enablingAutonomy: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    changeAndAmbiguity: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    desiredCulture: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    workAutonomously: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },

    // Stakeholders and Team (5 metrics)
    stakeholders: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    teamAttrition: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    teams: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    developingPeople: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    subordinatesForSuccess: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    }
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Compound index for efficient user queries sorted by date
assessmentSchema.index({ userId: 1, assessmentDate: -1 });

// Index for searching by employee name within user's assessments
assessmentSchema.index({ userId: 1, employeeName: 1 });

/**
 * Update the updatedAt timestamp before saving
 */
assessmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * Calculate theme averages
 * @returns {Object} - Average score per theme
 */
assessmentSchema.methods.calculateThemeAverages = function() {
  const metrics = this.metrics;

  return {
    'Strategic Vision': (
      metrics.sharedVision +
      metrics.strategy +
      metrics.businessAlignment +
      metrics.customerFocus
    ) / 4,

    'Focus and Engagement': (
      metrics.crossFunctionalTeams +
      metrics.clarityInPriorities +
      metrics.acceptanceCriteria +
      metrics.enablingFocus +
      metrics.engagement
    ) / 5,

    'Autonomy and Change': (
      metrics.feedback +
      metrics.enablingAutonomy +
      metrics.changeAndAmbiguity +
      metrics.desiredCulture +
      metrics.workAutonomously
    ) / 5,

    'Stakeholders and Team': (
      metrics.stakeholders +
      metrics.teamAttrition +
      metrics.teams +
      metrics.developingPeople +
      metrics.subordinatesForSuccess
    ) / 5
  };
};

/**
 * Calculate overall average score
 * @returns {number} - Overall average across all metrics
 */
assessmentSchema.methods.calculateOverallAverage = function() {
  const metrics = this.metrics;
  const values = Object.values(metrics);
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
};

const Assessment = mongoose.model('Assessment', assessmentSchema);

module.exports = Assessment;
