const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.warn('Supabase credentials not configured. Order storage will use file-based storage.');
  module.exports = null;
} else {
  const supabase = createClient(supabaseUrl, supabaseKey);
  logger.info('Supabase client initialized');
  module.exports = supabase;
}

