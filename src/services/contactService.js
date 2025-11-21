const Joi = require('joi');
const notificationService = require('./notificationService');
const { getDatabase } = require('../database/database');
const logger = require('../utils/logger');

/**
 * Contact Form Service
 * Handles contact form submissions and notifications
 */
class ContactService {
  constructor() {
    this.submissionSchema = this.createValidationSchema();
    this.db = getDatabase();
  }

  /**
   * Create Joi validation schema for contact form
   */
  createValidationSchema() {
    return Joi.object({
      name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
          'string.min': 'Name must be at least 2 characters long',
          'string.max': 'Name must not exceed 100 characters',
          'any.required': 'Name is required'
        }),
      
      email: Joi.string()
        .email()
        .required()
        .messages({
          'string.email': 'Please provide a valid email address',
          'any.required': 'Email is required'
        }),
      
      phone: Joi.string()
        .pattern(/^[\+]?[1-9][\d]{0,15}$/)
        .optional()
        .allow('')
        .messages({
          'string.pattern.base': 'Please provide a valid phone number'
        }),
      
      subject: Joi.string()
        .min(5)
        .max(200)
        .required()
        .messages({
          'string.min': 'Subject must be at least 5 characters long',
          'string.max': 'Subject must not exceed 200 characters',
          'any.required': 'Subject is required'
        }),
      
      message: Joi.string()
        .min(10)
        .max(2000)
        .required()
        .messages({
          'string.min': 'Message must be at least 10 characters long',
          'string.max': 'Message must not exceed 2000 characters',
          'any.required': 'Message is required'
        }),
      
      // Optional fields for tracking
      ip: Joi.string().optional(),
      userAgent: Joi.string().optional(),
      referrer: Joi.string().optional()
    });
  }

  /**
   * Validate contact form data
   * @param {Object} data - Form data to validate
   * @returns {Object} Validation result
   */
  validateSubmission(data) {
    const { error, value } = this.submissionSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return {
        isValid: false,
        errors
      };
    }

    return {
      isValid: true,
      data: value
    };
  }

  /**
   * Generate unique submission ID
   * @returns {string} Submission ID
   */
  generateSubmissionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `CF-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Process contact form submission
   * @param {Object} formData - Form submission data
   * @param {Object} requestInfo - Request metadata (IP, user agent, etc.)
   * @returns {Promise<Object>} Submission result
   */
  async processSubmission(formData, requestInfo = {}) {
    try {
      // Validate form data
      const validation = this.validateSubmission(formData);
      if (!validation.isValid) {
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      const validatedData = validation.data;
      
      // Add request metadata
      const submissionData = {
        ...validatedData,
        ip: requestInfo.ip || 'Unknown',
        userAgent: requestInfo.userAgent || 'Unknown',
        referrer: requestInfo.referrer || 'Unknown',
        submittedAt: new Date().toISOString()
      };

      logger.info({ 
        name: submissionData.name, 
        email: submissionData.email, 
        subject: submissionData.subject 
      }, 'Processing contact form submission');

      // Generate submission ID
      const submissionId = this.generateSubmissionId();

      // Store in database
      try {
        await this.db.createContact({
          id: submissionId,
          ...submissionData
        });
      } catch (storageError) {
        logger.error({ error: storageError.message }, 'Failed to save contact, continuing with notifications');
      }

      // Send notifications through all enabled channels
      const notificationResults = await notificationService.sendNotification(
        submissionData, 
        'contact_form'
      );

      // Send confirmation email to submitter
      const confirmationResult = await notificationService.sendNotification(
        submissionData,
        'confirmation'
      );

      return {
        success: true,
        message: 'Contact form submitted successfully',
        submissionId: submissionId,
        notifications: {
          lead: notificationResults,
          confirmation: confirmationResult
        }
      };

    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Error processing contact form submission');
      return {
        success: false,
        message: 'Failed to process submission',
        error: error.message
      };
    }
  }

  /**
   * Get contact form statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStats() {
    try {
      return await this.db.getContactStats();
    } catch (error) {
      logger.error({ error: error.message }, 'Error getting contact statistics');
      return {
        totalSubmissions: 0,
        todaySubmissions: 0,
        thisWeekSubmissions: 0,
        thisMonthSubmissions: 0
      };
    }
  }

  /**
   * Test notification channels
   * @returns {Promise<Object>} Test results
   */
  async testNotifications() {
    const testData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      subject: 'Test Contact Form',
      message: 'This is a test message to verify notification channels.',
      ip: '127.0.0.1'
    };

    try {
      const results = await notificationService.sendNotification(testData, 'contact_form');
      return {
        success: true,
        message: 'Notification test completed',
        results
      };
    } catch (error) {
      return {
        success: false,
        message: 'Notification test failed',
        error: error.message
      };
    }
  }
}

module.exports = new ContactService();
