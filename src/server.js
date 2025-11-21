const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const logger = require('./utils/logger');
const { initializeDatabase } = require('./database/database');

const testimonialsRoutes = require('./routes/testimonials');
const contactRoutes = require('./routes/contact');
const searchRoutes = require('./routes/search');
const enrollmentRoutes = require('./routes/enrollment');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import payment routes - webhook needs special handling
const paymentRoutes = require('./routes/payment');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const orderService = require('./services/orderService');

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
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook route must be registered BEFORE body parsing middleware and rate limiting
// Stripe webhooks require raw body for signature verification
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    logger.error('Stripe is not configured. Please set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET environment variables.');
    return res.status(500).json({ error: 'Stripe is not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.error({ error: err.message }, 'Webhook signature verification failed');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  logger.info({ eventType: event.type }, 'Received webhook event');
  
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      logger.info({ 
        sessionId: session.id, 
        customerEmail: session.customer_email,
        amountTotal: session.amount_total,
        paymentStatus: session.payment_status,
        metadata: session.metadata
      }, 'Payment successful for session');
      
      // Update order status to 'paid'
      try {
        const orderId = session.metadata?.orderId;
        logger.debug({ orderId }, 'Looking for order ID');
        
        if (orderId) {
          // Check if order already exists and is already paid (prevent duplicate processing)
          const existingOrder = await orderService.getOrderById(orderId);
          
          if (existingOrder) {
            // Check if this session was already processed
            if (existingOrder.stripeSessionId === session.id && existingOrder.status === 'paid') {
              logger.info({ orderId, sessionId: session.id }, 'Order already marked as paid for session. Skipping duplicate webhook.');
              return res.json({ received: true, message: 'Order already processed' });
            }
            
            // Check if order is already paid (even with different session - prevent duplicate payments)
            if (existingOrder.status === 'paid') {
              logger.warn({ 
                orderId, 
                currentSession: session.id, 
                previousSession: existingOrder.stripeSessionId 
              }, 'Order is already paid. Duplicate payment attempt detected. Skipping update.');
              return res.json({ received: true, message: 'Order already paid', warning: 'Duplicate payment attempt detected' });
            }
          }
          
          logger.info({ orderId }, 'Updating order to paid status');
          
          // Extract customer information
          const customerEmail = session.customer_email || session.customer_details?.email;
          const customerName = session.customer_details?.name || session.metadata?.customerName;
          const customerPhone = session.customer_details?.phone;
          
          // Extract shipping address (individual fields)
          const shippingAddress = session.shipping_details?.address;
          const shippingName = session.shipping_details?.name;
          
          // Extract tax information
          const totalDetails = session.total_details;
          const taxAmount = totalDetails?.amount_tax ? totalDetails.amount_tax / 100 : 0;
          
          const updatedOrder = await orderService.updateOrderStatus(orderId, 'paid', {
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent || null,
            paidAt: new Date().toISOString(),
            amountPaid: session.amount_total / 100, // Convert from cents to dollars
            currency: session.currency || 'usd',
            
            // Customer information
            customerEmail: customerEmail,
            customerName: customerName,
            customerPhone: customerPhone,
            
            // Shipping address (individual fields)
            shippingName: shippingName,
            shippingLine1: shippingAddress?.line1,
            shippingLine2: shippingAddress?.line2,
            shippingCity: shippingAddress?.city,
            shippingState: shippingAddress?.state,
            shippingPostalCode: shippingAddress?.postal_code,
            shippingCountry: shippingAddress?.country,
            
            // Tax information
            taxAmount: taxAmount,
            taxRate: session.automatic_tax?.enabled ? null : null, // Can be calculated if needed
          });
          logger.info({ orderId, updatedOrder }, 'Order marked as paid in database');
        } else {
          logger.warn({ sessionId: session.id }, 'No orderId found in session metadata, trying to find by session ID');
          // Fallback: try to find order by Stripe session ID
          const order = await orderService.findOrderByStripeSessionId(session.id);
          if (order) {
            logger.info({ orderId: order.id, sessionId: session.id }, 'Found order by session ID, updating to paid');
            await orderService.updateOrderStatus(order.id, 'paid', {
              paidAt: new Date().toISOString(),
              amountPaid: session.amount_total / 100,
              currency: session.currency || 'usd',
            });
            logger.info({ orderId: order.id }, 'Order marked as paid (found by session ID)');
          } else {
            logger.error({ 
              sessionId: session.id, 
              metadataKeys: Object.keys(session.metadata || {}) 
            }, 'Order not found for session');
          }
        }
      } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Error updating order status');
        // Don't fail the webhook - log error but return success
      }
      break;
    
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      logger.info({ paymentIntentId: paymentIntent.id }, 'PaymentIntent succeeded');
      // Order status should already be updated by checkout.session.completed
      // But we can use this as a backup
      break;
    
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      logger.warn({ paymentIntentId: failedPayment.id }, 'PaymentIntent failed');
      
      // Update order status to 'failed'
      try {
        // Try to find order by payment intent ID or session ID
        // Note: We might need to store payment_intent_id in order metadata
        const order = await orderService.findOrderByStripeSessionId(failedPayment.id);
        if (order) {
          await orderService.updateOrderStatus(order.id, 'failed', {
            error: failedPayment.last_payment_error?.message || 'Payment failed',
            failedAt: new Date().toISOString(),
          });
          logger.info({ orderId: order.id }, 'Order marked as failed');
        }
      } catch (error) {
        logger.error({ error: error.message }, 'Error updating failed order status');
      }
      break;
    
    case 'checkout.session.async_payment_failed':
      const failedSession = event.data.object;
      logger.warn({ sessionId: failedSession.id }, 'Checkout session payment failed');
      
      // Update order status to 'failed'
      try {
        const orderId = failedSession.metadata?.orderId;
        if (orderId) {
          await orderService.updateOrderStatus(orderId, 'failed', {
            error: 'Payment failed',
            failedAt: new Date().toISOString(),
          });
          logger.info({ orderId }, 'Order marked as failed');
        }
      } catch (error) {
        logger.error({ error: error.message }, 'Error updating failed order status');
      }
      break;
    
    default:
      logger.debug({ eventType: event.type }, 'Unhandled event type');
  }

  res.json({ received: true });
});

// Apply rate limiting to all other routes
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
app.use('/api/payment', paymentRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
  // Don't exit the process, just log the error
});

// Handle uncaught exceptions (but allow EADDRINUSE to exit so nodemon can restart)
process.on('uncaughtException', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error('Port already in use. Please kill the existing process or use a different port.');
    logger.error('Run: lsof -ti:3002 | xargs kill -9');
    process.exit(1);
  }
  logger.error({ error: error.message, stack: error.stack }, 'Uncaught Exception');
  // Don't exit for other errors, just log
});

// Start server
async function startServer() {
  // Initialize database connection
  try {
    await initializeDatabase();
    logger.info('Database connection initialized');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to initialize database connection');
    // Continue anyway - some adapters might not need explicit connection
  }

  const server = app.listen(PORT, () => {
        logger.info(`GrowWise Backend Server running on port ${PORT}`);
        logger.info(`Health check: http://localhost:${PORT}/health`);
        logger.info(`Testimonials API: http://localhost:${PORT}/api/testimonials`);
        logger.info(`Contact API: http://localhost:${PORT}/api/contact`);
        logger.info(`Search API: http://localhost:${PORT}/api/search`);
        logger.info(`Enrollment API: http://localhost:${PORT}/api/enrollment`);
        logger.info(`Payment API: http://localhost:${PORT}/api/payment`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use.`);
      logger.error('Please kill the existing process:');
      logger.error(`lsof -ti:${PORT} | xargs kill -9`);
      process.exit(1);
    } else {
      logger.error({ error: error.message }, 'Server error');
      throw error;
    }
  });
}

// Graceful shutdown
const { closeDatabase } = require('./database/database');

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await closeDatabase();
  process.exit(0);
});

startServer();
