import { ASSESSMENT_CONFIG } from './config.js';

/**
 * Performance Assessment Chart Application
 * 
 * Creates interactive polar area charts for employee performance evaluation
 * across 4 themes and 19 criteria.
 */
class PerformanceAssessment {
    constructor() {
        this.chart = null;
        this.employeeName = '';
        this.themes = ASSESSMENT_CONFIG.themes;
        this.currentAssessmentId = null; // Track current assessment being edited
    }

    /**
     * Initialize the assessment application
     */
    init() {
        this.setCurrentDate();
        this.initializeChart();
        this.attachEventListeners();

        // Check for assessment ID in URL
        const urlParams = new URLSearchParams(window.location.search);
        const assessmentId = urlParams.get('assessmentId');
        const mode = urlParams.get('mode'); // 'view' or 'edit'

        if (assessmentId) {
            // Load assessment from MongoDB
            this.loadAssessment(assessmentId);

            // If view mode, make form read-only
            if (mode === 'view') {
                this.setReadOnlyMode(true);
            }
        } else {
            // Load from localStorage as fallback
            this.loadFromLocalStorage();
        }
    }

    /**
     * Set current date in the header
     */
    setCurrentDate() {
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            dateElement.textContent = new Date().toLocaleDateString();
        }
    }

    /**
     * Validate and clamp input value between min and max
     * @param {string|number} value - Input value to validate
     * @returns {number} - Validated value clamped between 0-5
     */
    validateInput(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return 0;
        return Math.max(
            ASSESSMENT_CONFIG.ratingScale.min,
            Math.min(ASSESSMENT_CONFIG.ratingScale.max, num)
        );
    }

    /**
     * Sanitize employee name to prevent XSS
     * @param {string} name - Raw employee name
     * @returns {string} - Sanitized name
     */
    sanitizeEmployeeName(name) {
        const div = document.createElement('div');
        div.textContent = name;
        return div.innerHTML.trim();
    }

    /**
     * Sanitize filename for downloads
     * @param {string} name - Raw filename
     * @returns {string} - Sanitized filename
     */
    sanitizeFilename(name) {
        return name
            .trim()
            .replace(/[^a-z0-9_-]/gi, '_')
            .replace(/_{2,}/g, '_')
            .substring(0, 50);
    }

    /**
     * Initialize Chart.js polar area chart
     */
    initializeChart() {
        try {
            const canvas = document.getElementById('performanceChart');
            if (!canvas) {
                throw new Error('Canvas element not found');
            }

            const ctx = canvas.getContext('2d');
            const labels = [];
            const backgroundColor = [];
            const borderColor = [];

            // Build labels and colors from theme configuration
            Object.entries(this.themes).forEach(([theme, themeData]) => {
                themeData.metrics.forEach(metric => {
                    labels.push(`${theme}: ${metric.label}`);
                    backgroundColor.push(themeData.color.replace('%a', '0.5'));
                    borderColor.push(themeData.color.replace('%a', '1'));
                });
            });

            this.chart = new Chart(ctx, {
                type: 'polarArea',
                data: {
                    labels: labels,
                    datasets: [{
                        data: new Array(labels.length).fill(0),
                        backgroundColor: backgroundColor,
                        borderColor: borderColor,
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        r: {
                            min: ASSESSMENT_CONFIG.ratingScale.min,
                            max: ASSESSMENT_CONFIG.ratingScale.max,
                            ticks: {
                                stepSize: 1,
                                display: true,
                                backdropColor: 'rgba(255, 255, 255, 0.8)',
                            },
                            grid: {
                                circular: true,
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            angleLines: {
                                display: true,
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            pointLabels: {
                                display: true,
                                centerPointLabels: true,
                                font: {
                                    size: 10
                                },
                                callback: function (label) {
                                    // Split the label at the colon and return only the metric name
                                    return label.split(': ')[1];
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                generateLabels: () => {
                                    // Return only the four main themes for the legend
                                    return Object.entries(this.themes).map(([theme, themeData]) => ({
                                        text: theme,
                                        fillStyle: themeData.color.replace('%a', '0.5'),
                                        strokeStyle: themeData.color.replace('%a', '1'),
                                        lineWidth: 1,
                                        hidden: false,
                                    }));
                                }
                            },
                        },
                        title: {
                            display: true,
                            text: 'Results'
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => `Score: ${context.formattedValue}`
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to initialize chart:', error);
            this.showErrorMessage('Failed to load chart. Please refresh the page.');
        }
    }

    /**
     * Update chart with current form values
     */
    updateChart() {
        if (!this.chart) return;

        const values = [];

        Object.values(this.themes).forEach(themeData => {
            themeData.metrics.forEach(metric => {
                const input = document.getElementById(metric.id);
                if (!input) {
                    console.warn(`Missing input field: ${metric.id}`);
                    values.push(0);
                    return;
                }
                const value = this.validateInput(input.value);
                values.push(value);
            });
        });

        this.chart.data.datasets[0].data = values;
        this.chart.update();
    }

    /**
     * Debounce function to limit execution frequency
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Save assessment data to localStorage
     */
    saveToLocalStorage() {
        try {
            const formData = {};
            const inputs = document.querySelectorAll('#inputForm input[type="number"]');

            inputs.forEach(input => {
                formData[input.id] = input.value;
            });

            const data = {
                employeeName: this.employeeName,
                date: new Date().toISOString(),
                formData
            };

            localStorage.setItem('performanceAssessment', JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    /**
     * Load assessment data from localStorage
     */
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('performanceAssessment');
            if (!saved) return;

            const data = JSON.parse(saved);

            // Restore employee name
            const nameInput = document.getElementById('employeeName');
            if (nameInput && data.employeeName) {
                nameInput.value = data.employeeName;
                this.employeeName = data.employeeName;
            }

            // Restore form values
            Object.entries(data.formData).forEach(([id, value]) => {
                const input = document.getElementById(id);
                if (input) input.value = value;
            });

            this.updateChart();
        } catch (error) {
            console.error('Failed to load saved data:', error);
        }
    }

    /**
     * Collect all form metrics into an object
     * @returns {Object} - Object with all 19 metrics
     */
    collectFormData() {
        const metrics = {};
        Object.values(this.themes).forEach(themeData => {
            themeData.metrics.forEach(metric => {
                const input = document.getElementById(metric.id);
                if (input) {
                    metrics[metric.id] = parseInt(input.value) || 0;
                }
            });
        });
        return metrics;
    }

    /**
     * Save assessment to MongoDB
     */
    async saveToMongoDB() {
        try {
            // Check if authenticated
            if (!window.authManager || !window.authManager.isAuthenticated()) {
                console.log('Not authenticated, saving to localStorage only');
                this.saveToLocalStorage();
                return;
            }

            // Get employee name
            const nameInput = document.getElementById('employeeName');
            const employeeName = nameInput ? nameInput.value.trim() : '';

            const data = {
                employeeName: employeeName || 'Unknown',
                assessmentDate: new Date().toISOString(),
                metrics: this.collectFormData()
            };

            if (this.currentAssessmentId) {
                // Update existing assessment
                await api.updateAssessment(this.currentAssessmentId, data);
                this.showSuccessMessage('Assessment updated successfully');
            } else {
                // Create new assessment
                const response = await api.createAssessment(data);
                this.currentAssessmentId = response.assessment._id;
                this.showSuccessMessage('Assessment saved to database');
            }

            // Also save to localStorage as backup
            this.saveToLocalStorage();

        } catch (error) {
            console.error('MongoDB save error:', error);
            this.showErrorMessage('Could not save to database: ' + error.message);
            // Fallback to localStorage
            this.saveToLocalStorage();
            this.showSuccessMessage('Saved locally (offline mode)');
        }
    }

    /**
     * Load assessment from MongoDB
     * @param {string} assessmentId - MongoDB ObjectId
     */
    async loadAssessment(assessmentId) {
        try {
            if (!window.authManager || !window.authManager.isAuthenticated()) {
                this.showErrorMessage('Please log in to load assessments');
                return;
            }

            const response = await api.getAssessment(assessmentId);
            const assessment = response.assessment;

            // Set current assessment ID
            this.currentAssessmentId = assessment._id;

            // Restore employee name
            const nameInput = document.getElementById('employeeName');
            if (nameInput && assessment.employeeName) {
                nameInput.value = assessment.employeeName;
                this.employeeName = assessment.employeeName;
            }

            // Restore metrics
            Object.entries(assessment.metrics).forEach(([id, value]) => {
                const input = document.getElementById(id);
                if (input) {
                    input.value = value;
                }
            });

            this.updateChart();
            this.showSuccessMessage('Assessment loaded successfully');

        } catch (error) {
            console.error('Load assessment error:', error);
            this.showErrorMessage('Failed to load assessment: ' + error.message);
        }
    }

    /**
     * Start a new assessment (clear current one)
     */
    newAssessment() {
        this.currentAssessmentId = null;
        this.clearAll();
        this.showSuccessMessage('Ready for new assessment');
    }

    /**
     * Set form to read-only mode
     * @param {boolean} readOnly - True to make read-only, false to enable editing
     */
    setReadOnlyMode(readOnly) {
        const inputs = document.querySelectorAll('#inputForm input[type="number"], #employeeName');
        inputs.forEach(input => {
            input.readOnly = readOnly;
            if (readOnly) {
                input.style.backgroundColor = '#f5f5f5';
                input.style.cursor = 'not-allowed';
            } else {
                input.style.backgroundColor = '';
                input.style.cursor = '';
            }
        });

        // Show message if in read-only mode
        if (readOnly) {
            this.showSuccessMessage('Viewing assessment in read-only mode');
        }
    }

    /**
     * Export assessment data to CSV
     */
    saveToCSV() {
        try {
            const formData = new FormData(document.getElementById('inputForm'));
            let csvContent = "Categories,Ratings\n";

            for (let [key, value] of formData.entries()) {
                csvContent += `${key},${value}\n`;
            }

            // Create and trigger download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);

            // Use the employee name for the filename if available
            const sanitizedName = this.employeeName
                ? this.sanitizeFilename(this.employeeName)
                : 'user';
            const dateStr = new Date().toISOString().split('T')[0];
            const filename = `${sanitizedName}_assessment_${dateStr}.csv`;

            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Failed to save CSV:', error);
            this.showErrorMessage('Failed to save CSV file. Please try again.');
        }
    }

    /**
     * Clear all form values and reset chart
     */
    clearAll() {
        // Clear all number inputs
        const numberInputs = document.querySelectorAll('#inputForm input[type="number"]');
        numberInputs.forEach(input => {
            input.value = 0;
        });

        // Clear employee name
        const nameInput = document.getElementById('employeeName');
        if (nameInput) {
            nameInput.value = '';
            this.employeeName = '';
        }

        // Update chart title
        if (this.chart) {
            this.chart.options.plugins.title.text = 'Results';
        }

        // Update chart with zeros
        this.updateChart();

        // Clear localStorage
        localStorage.removeItem('performanceAssessment');

        // Show success message
        this.showSuccessMessage('All values have been cleared');
    }

    /**
     * Load assessment data from CSV file
     */
    loadFromCSV() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.style.display = 'none';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        this.parseAndLoadCSV(event.target.result);
                    } catch (error) {
                        console.error('Failed to load CSV:', error);
                        this.showErrorMessage('Failed to load CSV file. Please check the file format.');
                    }
                };
                reader.readAsText(file);
            }
            // Clean up
            document.body.removeChild(input);
        };

        // Append to DOM before clicking
        document.body.appendChild(input);
        input.click();
    }

    /**
     * Parse CSV content and load into form
     * @param {string} csvContent - Raw CSV file content
     */
    parseAndLoadCSV(csvContent) {
        const lines = csvContent.trim().split('\n');

        // Validate header
        if (lines.length < 2) {
            throw new Error('CSV file is empty or invalid');
        }

        const header = lines[0].toLowerCase();
        if (!header.includes('categories') || !header.includes('ratings')) {
            throw new Error('Invalid CSV format. Expected "Categories,Ratings" header');
        }

        let loadedCount = 0;
        const validMetricIds = new Set();

        // Build set of valid metric IDs from configuration
        Object.values(this.themes).forEach(themeData => {
            themeData.metrics.forEach(metric => {
                validMetricIds.add(metric.id);
            });
        });

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const [category, rating] = line.split(',').map(s => s.trim());

            // Validate metric ID exists in our configuration
            if (!validMetricIds.has(category)) {
                console.warn(`Unknown category in CSV: ${category}`);
                continue;
            }

            // Validate rating value
            const value = this.validateInput(rating);

            // Update form field
            const input = document.getElementById(category);
            if (input) {
                input.value = value;
                loadedCount++;
            }
        }

        if (loadedCount === 0) {
            throw new Error('No valid data found in CSV file');
        }

        // Update chart and save to localStorage
        this.updateChart();
        this.saveToLocalStorage();

        // Show success message
        this.showSuccessMessage(`Successfully loaded ${loadedCount} ratings from CSV`);
    }

    /**
     * Show error message to user
     * @param {string} message - Error message to display
     */
    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.setAttribute('role', 'alert');
        errorDiv.style.cssText = `
            padding: 10px;
            margin: 10px 0;
            background-color: #f44336;
            color: white;
            border-radius: 4px;
        `;

        const container = document.querySelector('.chart-container');
        if (container) {
            container.prepend(errorDiv);
            setTimeout(() => errorDiv.remove(), 5000);
        }
    }

    /**
     * Show success message to user
     * @param {string} message - Success message to display
     */
    showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        successDiv.setAttribute('role', 'status');
        successDiv.style.cssText = `
            padding: 10px;
            margin: 10px 0;
            background-color: #4CAF50;
            color: white;
            border-radius: 4px;
        `;

        const container = document.querySelector('.chart-container');
        if (container) {
            container.prepend(successDiv);
            setTimeout(() => successDiv.remove(), 3000);
        }
    }

    /**
     * Attach event listeners to form elements
     */
    attachEventListeners() {
        // Employee name input
        const nameInput = document.getElementById('employeeName');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.employeeName = this.sanitizeEmployeeName(e.target.value);

                // Update chart title
                if (this.chart) {
                    this.chart.options.plugins.title.text = this.employeeName
                        ? `${this.employeeName} - Results`
                        : 'Results';
                    this.chart.update();
                }
            });
        }

        // Number inputs - update chart on change and auto-save to MongoDB
        const debouncedUpdate = this.debounce(() => {
            this.updateChart();
            this.saveToMongoDB();
        }, 5000); // 5 seconds after last change

        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', debouncedUpdate.bind(this));
        });

        // Auto-save on employee name change
        if (nameInput) {
            const debouncedSave = this.debounce(() => {
                this.saveToMongoDB();
            }, 5000); // 5 seconds after last change
            nameInput.addEventListener('input', debouncedSave.bind(this));
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S to save to MongoDB
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveToMongoDB();
            }
        });
    }
}

// Initialize application when DOM is loaded
let assessmentApp;

document.addEventListener('DOMContentLoaded', () => {
    assessmentApp = new PerformanceAssessment();
    assessmentApp.init();
});

// Export for use in HTML
window.saveOnly = function () {
    if (assessmentApp) {
        assessmentApp.saveToCSV();
    }
};

window.loadFromCSV = function () {
    if (assessmentApp) {
        assessmentApp.loadFromCSV();
    }
};

window.clearAll = function () {
    if (assessmentApp) {
        assessmentApp.clearAll();
    }
};

window.loadAssessment = function (assessmentId) {
    if (assessmentApp) {
        assessmentApp.loadAssessment(assessmentId);
    }
};

window.newAssessment = function () {
    if (assessmentApp) {
        assessmentApp.newAssessment();
    }
};
