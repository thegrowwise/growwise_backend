/**
 * Database Factory
 * 
 * This module provides a centralized database adapter instance.
 * To switch databases, simply change the adapter import here.
 * 
 * Example: To switch from Supabase to MongoDB:
 * 1. Create MongoDBAdapter.js extending BaseAdapter
 * 2. Change the import below to: const Adapter = require('./adapters/MongoDBAdapter');
 * 3. Update environment variables
 * 4. Done! No other code changes needed.
 */

const SupabaseAdapter = require('./adapters/SupabaseAdapter');
const logger = require('../utils/logger');

// Select which database adapter to use
// To switch databases, change this import and update environment variables
const Adapter = SupabaseAdapter;

// Create singleton instance
let adapterInstance = null;

/**
 * Get the database adapter instance
 * @returns {BaseAdapter} Database adapter instance
 */
function getDatabase() {
  if (!adapterInstance) {
    adapterInstance = new Adapter();
    
    // Auto-connect if adapter supports it
    if (adapterInstance.connect) {
      adapterInstance.connect().catch(error => {
        logger.error({ error: error.message }, 'Failed to connect to database');
      });
    }
    
    logger.info('Database adapter initialized');
  }
  
  return adapterInstance;
}

/**
 * Initialize database connection
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
  const db = getDatabase();
  if (db.connect) {
    await db.connect();
  }
}

/**
 * Close database connection
 * @returns {Promise<void>}
 */
async function closeDatabase() {
  if (adapterInstance && adapterInstance.disconnect) {
    await adapterInstance.disconnect();
    adapterInstance = null;
  }
}

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase,
};

