const express = require('express');
const router = express.Router();
const websiteSearchService = require('../services/websiteSearchService');
const llmService = require('../services/llmService');

/**
 * Initialize LLM service for search
 */
websiteSearchService.setLLMService(llmService);

/**
 * POST /api/search
 * Search website content using LLM
 */
router.post('/', async (req, res, next) => {
  try {
    const { query, limit = 10, category = null, useLLM = true } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required and must be a string'
      });
    }

    if (query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters long'
      });
    }

    const searchResults = await websiteSearchService.search(query, {
      limit: parseInt(limit),
      category,
      useLLM: useLLM === true
    });

    res.json({
      success: true,
      data: searchResults,
      meta: {
        query,
        totalResults: searchResults.totalResults,
        searchTime: searchResults.searchTime,
        method: searchResults.method,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Search API error:', error);
    next(error);
  }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions based on query
 */
router.get('/suggestions', async (req, res, next) => {
  try {
    const { q: query, limit = 5 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        data: {
          suggestions: [
            'Math courses',
            'Python programming',
            'AI Explorer',
            'Free assessment',
            'STEAM courses'
          ]
        }
      });
    }

    // Get suggestions from search service
    const searchResults = await websiteSearchService.search(query, {
      limit: parseInt(limit),
      useLLM: false // Quick suggestions without LLM
    });

    res.json({
      success: true,
      data: {
        suggestions: searchResults.suggestions || [],
        query
      }
    });

  } catch (error) {
    console.error('❌ Suggestions API error:', error);
    next(error);
  }
});

/**
 * GET /api/search/categories
 * Get available search categories
 */
router.get('/categories', (req, res) => {
  try {
    const stats = websiteSearchService.getSearchStats();
    
    res.json({
      success: true,
      data: {
        categories: stats.categories,
        totalItems: stats.totalIndexedItems,
        lastUpdated: stats.lastUpdated
      }
    });
  } catch (error) {
    console.error('❌ Categories API error:', error);
    next(error);
  }
});

/**
 * GET /api/search/stats
 * Get search service statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = websiteSearchService.getSearchStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Stats API error:', error);
    next(error);
  }
});

/**
 * POST /api/search/index
 * Add content to search index (for dynamic content)
 */
router.post('/index', async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!content || !content.title || !content.content) {
      return res.status(400).json({
        success: false,
        error: 'Content must have title and content fields'
      });
    }

    websiteSearchService.addDynamicContent(content);

    res.json({
      success: true,
      message: 'Content added to search index',
      data: {
        id: `dynamic_${Date.now()}`,
        title: content.title,
        category: content.category || 'dynamic'
      }
    });

  } catch (error) {
    console.error('❌ Index API error:', error);
    next(error);
  }
});

/**
 * PUT /api/search/index/:id
 * Update content in search index
 */
router.put('/index/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    websiteSearchService.updateContent(id, content);

    res.json({
      success: true,
      message: 'Content updated in search index',
      data: { id }
    });

  } catch (error) {
    console.error('❌ Update index API error:', error);
    next(error);
  }
});

/**
 * DELETE /api/search/index/:id
 * Remove content from search index
 */
router.delete('/index/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    websiteSearchService.removeContent(id);

    res.json({
      success: true,
      message: 'Content removed from search index',
      data: { id }
    });

  } catch (error) {
    console.error('❌ Delete index API error:', error);
    next(error);
  }
});

module.exports = router;
