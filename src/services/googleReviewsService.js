const axios = require('axios');

class GoogleReviewsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY;
    this.placeId = process.env.GOOGLE_PLACE_ID;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/place';
    
    if (!this.apiKey) {
      console.warn('⚠️ GOOGLE_PLACES_API_KEY not found in environment variables');
    }
    if (!this.placeId) {
      console.warn('⚠️ GOOGLE_PLACE_ID not found in environment variables');
    }
  }

  /**
   * Get reviews from Google Places API
   * @returns {Promise<Array>} Array of review objects
   */
  async getReviews() {
    if (!this.apiKey || !this.placeId) {
      throw new Error('Google Places API key or Place ID not configured');
    }

    try {
      console.log('🔍 Fetching reviews from Google Places API...');
      
      const response = await axios.get(`${this.baseUrl}/details/json`, {
        params: {
          place_id: this.placeId,
          fields: 'reviews,rating,user_ratings_total',
          key: this.apiKey
        },
        timeout: 10000 // 10 second timeout
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Places API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
      }

      const placeDetails = response.data.result;
      const reviews = placeDetails.reviews || [];
      
      console.log(`✅ Successfully fetched ${reviews.length} reviews from Google Places API`);
      
      return reviews;
    } catch (error) {
      console.error('❌ Error fetching reviews from Google Places API:', error.message);
      
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error_message || error.message;
        
        if (status === 403) {
          throw new Error('Google Places API access denied. Please check your API key and billing.');
        } else if (status === 404) {
          throw new Error('Place not found. Please check your Place ID.');
        } else if (status === 429) {
          throw new Error('Google Places API quota exceeded. Please try again later.');
        } else {
          throw new Error(`Google Places API error (${status}): ${message}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. Google Places API is taking too long to respond.');
      } else {
        throw new Error(`Network error: ${error.message}`);
      }
    }
  }

  /**
   * Get place information
   * @returns {Promise<Object>} Place information
   */
  async getPlaceInfo() {
    if (!this.apiKey || !this.placeId) {
      throw new Error('Google Places API key or Place ID not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/details/json`, {
        params: {
          place_id: this.placeId,
          fields: 'name,rating,user_ratings_total,formatted_address,website,phone_number',
          key: this.apiKey
        },
        timeout: 10000
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      return response.data.result;
    } catch (error) {
      console.error('❌ Error fetching place info:', error.message);
      throw error;
    }
  }

  /**
   * Validate API configuration
   * @returns {Object} Validation result
   */
  validateConfiguration() {
    const issues = [];
    
    if (!this.apiKey) {
      issues.push('GOOGLE_PLACES_API_KEY is not set');
    }
    
    if (!this.placeId) {
      issues.push('GOOGLE_PLACE_ID is not set');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

module.exports = new GoogleReviewsService();
