const EmailStrategyFactory = require('../strategies/emailStrategyFactory');
const { getEmailTemplate } = require('../config/emailTemplates');
const { getDatabase } = require('../database/database');
const logger = require('../utils/logger');

/**
 * Enrollment Service for handling course enrollment notifications
 * Integrates with existing notification service architecture
 */
class EnrollmentService {
  constructor() {
    this.emailStrategyFactory = new EmailStrategyFactory();
    this.db = getDatabase();
  }

  /**
   * Generate unique enrollment ID
   */
  generateEnrollmentId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `ENR-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Send enrollment notifications to both business and user
   * @param {Object} enrollmentData - Enrollment form data
   */
  async sendEnrollmentNotifications(enrollmentData) {
    try {
      logger.info({ fullName: enrollmentData.fullName, email: enrollmentData.email }, 'Sending enrollment notifications');
      
      // Generate enrollment ID
      const enrollmentId = this.generateEnrollmentId();
      
      // Store enrollment in database first
      try {
        await this.db.createEnrollment({
          id: enrollmentId,
          ...enrollmentData
        });
      } catch (storageError) {
        logger.error({ error: storageError.message }, 'Failed to save enrollment, continuing with notifications');
      }
      
      let businessResult = null;
      let userResult = null;
      
      // Try to send business notification (non-blocking)
      try {
        businessResult = await this.sendBusinessNotification(enrollmentData);
        if (businessResult.success) {
          logger.info({ enrollmentId }, 'Business notification sent successfully');
          // Update enrollment with email status
          await this.db.updateEnrollmentEmailStatus(enrollmentId, 'business', true, businessResult.emailId);
        } else {
          logger.warn({ error: businessResult.error, enrollmentId }, 'Business notification failed');
        }
      } catch (error) {
        logger.error({ error: error.message, enrollmentId }, 'Business notification error');
        businessResult = { success: false, error: error.message };
      }
      
      // Try to send user confirmation (non-blocking)
      try {
        userResult = await this.sendUserConfirmation(enrollmentData);
        if (userResult.success) {
          logger.info({ enrollmentId }, 'User confirmation sent successfully');
          // Update enrollment with email status
          await this.db.updateEnrollmentEmailStatus(enrollmentId, 'user', true, userResult.emailId);
        } else {
          logger.warn({ error: userResult.error, enrollmentId }, 'User confirmation failed');
        }
      } catch (error) {
        logger.error({ error: error.message, enrollmentId }, 'User confirmation error');
        userResult = { success: false, error: error.message };
      }

      // Always return success for enrollment (emails are secondary)
      const businessSent = businessResult && businessResult.success;
      const userSent = userResult && userResult.success;
      
      // If both emails failed, log for manual processing
      if (!businessSent && !userSent) {
        logger.warn({ email: enrollmentData.email, enrollmentId }, 'Both emails failed, enrollment requires manual processing');
      }
      
      return {
        success: true, // Always return success for enrollment
        enrollmentId: enrollmentId,
        businessEmail: businessResult,
        userEmail: userResult,
        message: 'Enrollment processed successfully'
      };

    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Enrollment notification error');
      // Even if there's an error, return success for enrollment
      return {
        success: true,
        businessEmail: { success: false, error: error.message },
        userEmail: { success: false, error: error.message },
        message: 'Enrollment processed successfully'
      };
    }
  }

  /**
   * Send notification to business about new enrollment
   */
  async sendBusinessNotification(enrollmentData) {
    try {
      const emailStrategy = this.emailStrategyFactory.getBestStrategy();
      
      // Prepare template data
      const templateData = {
        studentName: enrollmentData.fullName,
        studentEmail: enrollmentData.email,
        studentPhone: enrollmentData.mobile,
        location: `${enrollmentData.city}, ${enrollmentData.postal}`,
        level: enrollmentData.level,
        bootcamp: enrollmentData.bootcamp,
        course: enrollmentData.course,
        timestamp: new Date(enrollmentData.timestamp).toLocaleString(),
        ipAddress: enrollmentData.ip
      };

      // Get email template
      const emailTemplate = getEmailTemplate('business', 'enrollment', templateData);
      
      const emailData = {
        to: [
          process.env.BUSINESS_EMAIL || 'info@growwise.com',
          process.env.ENROLLMENT_EMAIL || 'enrollments@growwise.com'
        ],
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
        templateData
      };

      const result = await emailStrategy.sendEmail(emailData);
      
      logger.info({ result }, 'Business enrollment notification sent');
      return {
        success: true,
        emailId: result.messageId || `business_${Date.now()}`,
        message: 'Business notification sent successfully',
        ...result
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Business notification error');
      return { 
        success: false, 
        error: error.message,
        emailId: null
      };
    }
  }

  /**
   * Send confirmation email to user
   */
  async sendUserConfirmation(enrollmentData) {
    try {
      const emailStrategy = this.emailStrategyFactory.getBestStrategy();
      
      // Prepare template data
      const templateData = {
        studentName: enrollmentData.fullName,
        studentEmail: enrollmentData.email,
        level: enrollmentData.level,
        bootcamp: enrollmentData.bootcamp,
        course: enrollmentData.course,
        timestamp: new Date(enrollmentData.timestamp).toLocaleString()
      };

      // Get email template
      const emailTemplate = getEmailTemplate('user', 'enrollment', templateData);
      
      const emailData = {
        to: [enrollmentData.email],
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
        templateData
      };

      const result = await emailStrategy.sendEmail(emailData);
      
      logger.info({ result }, 'User confirmation email sent');
      return {
        success: true,
        emailId: result.messageId || `user_${Date.now()}`,
        message: 'User confirmation sent successfully',
        ...result
      };

    } catch (error) {
      logger.error({ error: error.message }, 'User confirmation error');
      return { 
        success: false, 
        error: error.message,
        emailId: null
      };
    }
  }
}

module.exports = EnrollmentService;
