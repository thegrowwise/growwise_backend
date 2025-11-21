const express = require('express');
const router = express.Router();
const contactService = require('../services/contactService');
const notificationService = require('../services/notificationService');

/**
 * POST /api/contact
 * Submit contact form
 */
router.post('/', async (req, res, next) => {
  try {
    // Extract request metadata
    const requestInfo = {
      ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      referrer: req.headers.referer || req.headers.referrer
    };

    // Process the contact form submission
    const result = await contactService.processSubmission(req.body, requestInfo);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        submissionId: result.submissionId,
        meta: {
          timestamp: new Date().toISOString(),
          channels: Object.keys(result.notifications.lead)
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        errors: result.errors || null
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/contact/stats
 * Get contact form statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await contactService.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/contact/test
 * Test notification channels
 */
router.post('/test', async (req, res, next) => {
  try {
    const result = await contactService.testNotifications();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.results
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/contact/channels
 * Get available notification channels
 */
router.get('/channels', async (req, res, next) => {
  try {
    const channels = notificationService.getAvailableChannels();
    res.json({
      success: true,
      data: {
        available: channels,
        configured: process.env.NOTIFICATION_CHANNELS?.split(',') || ['email']
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/contact/strategies
 * Get available email strategies and their status
 */
router.get('/strategies', (req, res) => {
  try {
    const emailFactory = notificationService.getEmailStrategyFactory();
    const strategies = emailFactory.getAvailableStrategies();
    const configStatus = emailFactory.getConfigurationStatus();
    
    res.json({
      success: true,
      data: {
        strategies,
        configuration: configStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/contact/health
 * Check email configuration health using Strategy Pattern
 */
router.get('/health', async (req, res, next) => {
  try {
    const emailTest = await notificationService.testEmailConnection();
    const configStatus = notificationService.getConfigurationStatus();
    
    res.json({
      success: true,
      data: {
        email: emailTest,
        configuration: configStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
