const express = require('express');
const router = express.Router();
const testimonialsService = require('../services/testimonialsService');

/**
 * GET /api/testimonials
 * Fetch testimonials from Google Reviews with caching
 */
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset = 0, forceRefresh = false, minRating = 1 } = req.query;

    const testimonials = await testimonialsService.getTestimonials({
      limit: limit ? parseInt(limit) : null,
      offset: parseInt(offset),
      forceRefresh: forceRefresh === 'true',
      minRating: parseInt(minRating)
    });

    res.json({
      success: true,
      data: testimonials,
      meta: {
        count: testimonials.testimonials?.length || 0,
        limit: limit ? parseInt(limit) : null,
        offset: parseInt(offset),
        cached: testimonials.cached || false,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/testimonials/refresh
 * Force refresh testimonials from Google API
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const testimonials = await testimonialsService.refreshTestimonials();
    
    res.json({
      success: true,
      message: 'Testimonials refreshed successfully',
      data: testimonials,
      meta: {
        count: testimonials.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/testimonials/stats
 * Get cache statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await testimonialsService.getCacheStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
