const EmailStrategyFactory = require('../strategies/emailStrategyFactory');
const { getEmailTemplate } = require('../config/emailTemplates');
const fs = require('fs').promises;
const path = require('path');

/**
 * Enrollment Service for handling course enrollment notifications
 * Integrates with existing notification service architecture
 */
class EnrollmentService {
  constructor() {
    this.emailStrategyFactory = new EmailStrategyFactory();
  }

  /**
   * Send enrollment notifications to both business and user
   * @param {Object} enrollmentData - Enrollment form data
   */
  async sendEnrollmentNotifications(enrollmentData) {
    try {
      console.log('📧 Sending enrollment notifications for:', enrollmentData.fullName);
      
      let businessResult = null;
      let userResult = null;
      
      // Try to send business notification (non-blocking)
      try {
        businessResult = await this.sendBusinessNotification(enrollmentData);
        if (businessResult.success) {
          console.log('✅ Business notification sent successfully');
        } else {
          console.warn('⚠️ Business notification failed:', businessResult.error);
        }
      } catch (error) {
        console.error('❌ Business notification error:', error.message);
        businessResult = { success: false, error: error.message };
      }
      
      // Try to send user confirmation (non-blocking)
      try {
        userResult = await this.sendUserConfirmation(enrollmentData);
        if (userResult.success) {
          console.log('✅ User confirmation sent successfully');
        } else {
          console.warn('⚠️ User confirmation failed:', userResult.error);
        }
      } catch (error) {
        console.error('❌ User confirmation error:', error.message);
        userResult = { success: false, error: error.message };
      }

      // Always return success for enrollment (emails are secondary)
      const businessSent = businessResult && businessResult.success;
      const userSent = userResult && userResult.success;
      
      // If both emails failed, store enrollment data for manual processing
      if (!businessSent && !userSent) {
        await this.storeEnrollmentForManualProcessing(enrollmentData);
      }
      
      return {
        success: true, // Always return success for enrollment
        businessEmail: businessResult,
        userEmail: userResult,
        message: 'Enrollment processed successfully'
      };

    } catch (error) {
      console.error('❌ Enrollment notification error:', error);
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
      
      console.log('✅ Business enrollment notification sent:', result);
      return {
        success: true,
        emailId: result.messageId || `business_${Date.now()}`,
        message: 'Business notification sent successfully',
        ...result
      };

    } catch (error) {
      console.error('❌ Business notification error:', error);
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
      
      console.log('✅ User confirmation email sent:', result);
      return {
        success: true,
        emailId: result.messageId || `user_${Date.now()}`,
        message: 'User confirmation sent successfully',
        ...result
      };

    } catch (error) {
      console.error('❌ User confirmation error:', error);
      return { 
        success: false, 
        error: error.message,
        emailId: null
      };
    }
  }

  /**
   * Store enrollment data for manual processing when emails fail
   * @param {Object} enrollmentData - Enrollment form data
   */
  async storeEnrollmentForManualProcessing(enrollmentData) {
    try {
      const dataDir = path.join(__dirname, '../../data');
      const fileName = `enrollment_${Date.now()}_${enrollmentData.fullName.replace(/\s+/g, '_')}.json`;
      const filePath = path.join(dataDir, fileName);
      
      // Ensure data directory exists
      await fs.mkdir(dataDir, { recursive: true });
      
      // Store enrollment data with timestamp
      const storedData = {
        ...enrollmentData,
        storedAt: new Date().toISOString(),
        reason: 'Email delivery failed - manual processing required'
      };
      
      await fs.writeFile(filePath, JSON.stringify(storedData, null, 2));
      console.log(`📁 Enrollment data stored for manual processing: ${fileName}`);
      
    } catch (error) {
      console.error('❌ Failed to store enrollment data:', error.message);
    }
  }

}

module.exports = EnrollmentService;
