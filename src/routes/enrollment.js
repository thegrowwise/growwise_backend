const express = require('express');
const router = express.Router();
const EnrollmentService = require('../services/enrollmentService');

const enrollmentService = new EnrollmentService();

/**
 * POST /api/enrollment
 * Handle course enrollment form submission
 */
router.post('/', async (req, res) => {
  try {
    const {
      fullName,
      email,
      mobile,
      city,
      postal,
      bootcamp,
      course,
      level,
      agree
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !mobile || !city || !postal || !level) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate phone format
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanPhone = mobile.replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone format'
      });
    }

    // Validate agreement
    if (!agree) {
      return res.status(400).json({
        success: false,
        error: 'You must agree to receive communications'
      });
    }

    // Prepare enrollment data
    const enrollmentData = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      city: city.trim(),
      postal: postal.trim(),
      bootcamp: bootcamp?.trim() || 'None',
      course: course?.trim() || 'None',
      level: level.trim(),
      agree,
      timestamp: new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown'
    };

    // Send enrollment notifications (non-blocking)
    const notificationResult = await enrollmentService.sendEnrollmentNotifications(enrollmentData);

    // Log the enrollment submission with email status (for internal monitoring only)
    const businessSent = notificationResult.businessEmail && notificationResult.businessEmail.success;
    const userSent = notificationResult.userEmail && notificationResult.userEmail.success;
    
    console.log('✅ Enrollment processed successfully:', {
      student: enrollmentData.fullName,
      email: enrollmentData.email,
      businessEmailSent: businessSent,
      userEmailSent: userSent
    });

    // Always return success to the user
    res.json({
      success: true,
      message: 'Enrollment information received successfully. We will contact you within 24 hours.'
    });

  } catch (error) {
    console.error('❌ Enrollment API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An unknown error occurred',
      message: 'Failed to process your enrollment. Please try again or contact us directly.'
    });
  }
});

module.exports = router;
