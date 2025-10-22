const googleReviewsService = require('./googleReviewsService');

class TestimonialsService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = parseInt(process.env.CACHE_TTL) || 3600; // 1 hour default
  }

  /**
   * Get testimonials with simple caching
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of testimonials to return
   * @param {number} options.offset - Offset for pagination
   * @param {boolean} options.forceRefresh - Force refresh from API
   * @param {number} options.minRating - Minimum rating to filter (default: 1)
   * @returns {Promise<Array>} Array of testimonials
   */
  async getTestimonials({ limit = null, offset = 0, forceRefresh = false, minRating = 1 } = {}) {
    try {
      // Check cache first unless force refresh is requested
      if (!forceRefresh && this.cache.has('testimonials')) {
        const cachedData = this.cache.get('testimonials');
        if (cachedData && Date.now() - cachedData.timestamp < this.cacheTTL * 1000) {
          console.log('📦 Serving testimonials from cache');
          const filteredCachedData = cachedData.data.filter(review => review.rating >= minRating);
          if (limit === null) {
            return { 
              testimonials: filteredCachedData, 
              pagination: { total: filteredCachedData.length, limit: null, offset, hasMore: false },
              cached: true 
            };
          }
          const paginatedData = this.paginateData(filteredCachedData, limit, offset);
          return { ...paginatedData, cached: true };
        }
      }

      console.log('🔄 Fetching testimonials from Google Reviews API');
      const reviews = await googleReviewsService.getReviews();
      
      if (!reviews || reviews.length === 0) {
        throw new Error('No reviews found from Google API');
      }

      // Transform reviews to match frontend format
      const transformedReviews = reviews.map(this.transformGoogleReview);
      
      // Filter by minimum rating
      const filteredReviews = transformedReviews.filter(review => review.rating >= minRating);
      
      // Cache the results
      this.cache.set('testimonials', {
        data: transformedReviews, // Cache all reviews, filter when serving
        timestamp: Date.now()
      });
      console.log('💾 Testimonials cached successfully');

      // Return results (all if no limit specified)
      if (limit === null) {
        return { 
          testimonials: filteredReviews, 
          pagination: { total: filteredReviews.length, limit: null, offset, hasMore: false },
          cached: false 
        };
      }
      const paginatedData = this.paginateData(filteredReviews, limit, offset);
      return { ...paginatedData, cached: false };
      
    } catch (error) {
      console.error('❌ Error fetching testimonials:', error);
      
      // Try to return cached data as fallback
        if (this.cache.has('testimonials')) {
          const cachedData = this.cache.get('testimonials');
          console.log('⚠️ Using cached data as fallback');
          const filteredCachedData = cachedData.data.filter(review => review.rating >= minRating);
          if (limit === null) {
            return { 
              testimonials: filteredCachedData, 
              pagination: { total: filteredCachedData.length, limit: null, offset, hasMore: false },
              cached: true, 
              fallback: true 
            };
          }
          const paginatedData = this.paginateData(filteredCachedData, limit, offset);
          return { ...paginatedData, cached: true, fallback: true };
        }
      
      throw error;
    }
  }

  /**
   * Force refresh testimonials from Google API
   * @returns {Promise<Array>} Array of fresh testimonials
   */
  async refreshTestimonials() {
    try {
      console.log('🔄 Force refreshing testimonials...');
      const reviews = await googleReviewsService.getReviews();
      
      if (!reviews || reviews.length === 0) {
        throw new Error('No reviews found from Google API');
      }

      const transformedReviews = reviews.map(this.transformGoogleReview);
      
      // Update cache with fresh data
      this.cache.set('testimonials', {
        data: transformedReviews,
        timestamp: Date.now()
      });
      console.log('✅ Testimonials refreshed and cached successfully');

      return transformedReviews;
    } catch (error) {
      console.error('❌ Error refreshing testimonials:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    try {
      const cachedData = this.cache.get('testimonials');
      
      return {
        type: 'memory',
        connected: true,
        stats: {
          keys: this.cache.size,
          hits: 0,
          misses: 0,
          ksize: 0,
          vsize: 0
        },
        testimonials: {
          cached: !!cachedData,
          count: cachedData ? cachedData.data.length : 0,
          ttl: this.cacheTTL
        }
      };
    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      throw error;
    }
  }

  /**
   * Transform Google Review to match frontend format
   * @param {Object} googleReview - Google review object
   * @returns {Object} Transformed testimonial object
   */
  transformGoogleReview(googleReview) {
    const {
      author_name,
      author_url,
      profile_photo_url,
      rating,
      relative_time_description,
      text,
      time
    } = googleReview;

    // Generate a fallback avatar if profile photo is not available
    const getAvatarUrl = (profilePhotoUrl, authorName) => {
      if (profilePhotoUrl) {
        return profilePhotoUrl;
      }
      
      // Generate a placeholder avatar using a service like UI Avatars
      const initials = authorName
        .split(' ')
        .map(name => name.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
      
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&size=150&background=1F396D&color=ffffff&bold=true`;
    };

    // Clean and format the review text
    const cleanText = (text || '').trim();
    
    // Determine role based on review content or use a generic role
    const getRole = (reviewText) => {
      const text = reviewText.toLowerCase();
      if (text.includes('parent') || text.includes('child') || text.includes('daughter') || text.includes('son') || text.includes('my child') || text.includes('my daughter') || text.includes('my son')) {
        return 'Parent';
      } else if (text.includes('student') || text.includes('i am') || text.includes('i was') || text.includes('i have been')) {
        return 'Student';
      } else {
        return 'Parent'; // Default to Parent for educational service
      }
    };

    // Format the name properly
    const formatName = (name) => {
      if (!name) return 'Anonymous';
      return name.trim();
    };

    return {
      name: formatName(author_name),
      role: getRole(cleanText),
      content: cleanText || 'No review text available',
      rating: parseInt(rating) || 5,
      image: getAvatarUrl(profile_photo_url, author_name),
      // Additional metadata that might be useful
      metadata: {
        authorUrl: author_url,
        reviewTime: time,
        relativeTime: relative_time_description,
        originalRating: rating
      }
    };
  }

  /**
   * Paginate data based on limit and offset
   * @param {Array} data - Array of testimonials
   * @param {number} limit - Number of items per page
   * @param {number} offset - Starting index
   * @returns {Object} Paginated data with metadata
   */
  paginateData(data, limit, offset) {
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedData = data.slice(startIndex, endIndex);
    
    return {
      testimonials: paginatedData,
      pagination: {
        total: data.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: endIndex < data.length
      }
    };
  }
}

module.exports = new TestimonialsService();
