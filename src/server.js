const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const testimonialsRoutes = require('./routes/testimonials');
const contactRoutes = require('./routes/contact');
const searchRoutes = require('./routes/search');
const enrollmentRoutes = require('./routes/enrollment');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    process.env.CORS_ORIGIN
  ].filter(Boolean),
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/enrollment', enrollmentRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
function startServer() {
  app.listen(PORT, () => {
        console.log(`🚀 GrowWise Backend Server running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`🔗 Testimonials API: http://localhost:${PORT}/api/testimonials`);
        console.log(`📧 Contact API: http://localhost:${PORT}/api/contact`);
        console.log(`🔍 Search API: http://localhost:${PORT}/api/search`);
        console.log(`🎓 Enrollment API: http://localhost:${PORT}/api/enrollment`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
