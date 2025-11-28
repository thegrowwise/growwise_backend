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

// Detect if we're in a serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_TARGET;

// Trust proxy - REQUIRED for Vercel and other reverse proxies
// This allows Express to correctly identify client IPs and handle X-Forwarded-* headers
// Without this, rate limiting and other IP-based features won't work correctly
app.set('trust proxy', true);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:3003',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://growwiseschool.org',
    'https://www.growwiseschool.org',
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'stripe-signature']
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Rate limiting
// In serverless/proxy environments (like Vercel), we need to trust the proxy
// Configure the rate limiter to work correctly with trusted proxies
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => {
    return req.path === '/health' || req.path === '/';
  },
  // Disable validation warnings for proxy environments
  // In Vercel, the proxy is trusted and we've already set trust proxy
  validate: false, // Disable all validation checks (including trust proxy warning)
});

// Webhook route must be registered FIRST (before body parsing middleware)
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

// Register checkout session route directly on app (before router mounting)
// This ensures it works correctly in Vercel serverless environment
// The route handler logic is duplicated here to avoid router mounting issues
app.post('/api/payment/create-checkout-session', limiter, express.json({ limit: '10mb' }), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ 
      error: 'Stripe is not configured',
      message: 'Please set STRIPE_SECRET_KEY environment variable'
    });
  }

  try {
    logger.info({ method: req.method, path: req.path, url: req.url }, 'Creating checkout session');
    logger.debug({ body: req.body }, 'Checkout session request body');
    const { items, customerEmail, customerName, locale = 'en' } = req.body;
    logger.debug({ itemsCount: items?.length, locale, hasEmail: !!customerEmail }, 'Parsed checkout data');

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required and cannot be empty' });
    }

    // Validate items structure
    for (const item of items) {
      if (!item.id || !item.name || typeof item.price !== 'number' || !item.quantity) {
        return res.status(400).json({ error: 'Each item must have id, name, price, and quantity' });
      }
    }

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity * 100), 0); // Convert to cents

    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'Total amount must be greater than 0' });
    }

    // Check if there's already a pending order with the same items (prevent duplicate orders)
    const existingOrders = await orderService.getOrdersByEmail(customerEmail || '');
    const recentPendingOrder = existingOrders.find(o => 
      o.status === 'pending' && 
      o.items.length === items.length &&
      JSON.stringify(o.items.map(i => ({ id: i.id, quantity: i.quantity }))) === 
      JSON.stringify(items.map(i => ({ id: i.id, quantity: i.quantity }))) &&
      new Date(o.createdAt) > new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
    );
    
    let order;
    if (recentPendingOrder && recentPendingOrder.stripeSessionId) {
      // If there's a recent pending order with a Stripe session, return that session
      logger.warn({ orderId: recentPendingOrder.id, sessionId: recentPendingOrder.stripeSessionId }, 'Found existing pending order with session');
      logger.info('Returning existing session to prevent duplicate payment');
      
      // Retrieve the session from Stripe to get the URL
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(recentPendingOrder.stripeSessionId);
        if (existingSession.status === 'open') {
          return res.json({
            sessionId: existingSession.id,
            orderId: recentPendingOrder.id,
            url: existingSession.url,
            warning: 'Using existing checkout session'
          });
        }
      } catch (err) {
        logger.info('Existing session not found or expired, creating new order');
      }
    }
    
    // Create order in database BEFORE creating Stripe session
    try {
      logger.info('Creating order in database');
      order = await orderService.createOrder({
        items: items,
        customerEmail: customerEmail,
        customerName: customerName,
        locale: locale,
        totalAmount: totalAmount / 100, // Convert back to dollars
        status: 'pending',
      });
      logger.info({ orderId: order.id }, 'Order created successfully');
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Error creating order');
      return res.status(500).json({ 
        error: 'Failed to create order',
        message: error.message 
      });
    }

    // Create line items for Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: item.description || `${item.category || 'Course'} - ${item.level || ''}`.trim(),
          images: item.image ? [item.image] : undefined,
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Determine success and cancel URLs based on locale
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/${locale}/cart`;
    
    logger.debug({ successUrl, cancelUrl, baseUrl }, 'Checkout URLs configured');

    // Prepare metadata (Stripe has 500 character limit per metadata value)
    const itemIds = items.map(item => item.id).join(',');
    const itemNames = items.map(item => item.name).join('; ');
    
    const metadata = {
      orderId: order.id,
      locale: locale || 'en',
      itemCount: items.length.toString(),
      totalAmount: (items.reduce((sum, item) => sum + (item.price * item.quantity), 0)).toString(),
    };
    
    if (customerName) {
      metadata.customerName = customerName.substring(0, 200);
    }
    
    if (itemIds.length <= 200) {
      metadata.itemIds = itemIds;
    } else {
      metadata.itemIds = itemIds.substring(0, 197) + '...';
    }
    
    if (itemNames.length > 0) {
      metadata.firstItem = itemNames.substring(0, 200);
    }

    // Create Stripe checkout session
    let session;
    try {
      logger.info('Creating Stripe checkout session');
      logger.debug({ lineItems }, 'Stripe line items');
      
      const idempotencyKey = `checkout_${order.id}_${Date.now()}`;
      
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail,
        metadata: metadata,
        shipping_address_collection: {
          allowed_countries: ['US', 'CA', 'GB', 'AU', 'IN'],
        },
        automatic_tax: {
          enabled: true,
        },
        allow_promotion_codes: true,
        payment_intent_data: {
          metadata: metadata,
        },
      }, {
        idempotencyKey: idempotencyKey,
      });
      
      logger.info({ sessionId: session.id, url: session.url }, 'Stripe session created successfully');

      // Update order with Stripe session ID (non-blocking)
      orderService.updateOrderStatus(order.id, 'pending', {
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent || null,
      }).then(() => {
        logger.info({ orderId: order.id, sessionId: session.id }, 'Order updated with Stripe session ID');
      }).catch((updateError) => {
        logger.warn({ error: updateError.message, orderId: order.id }, 'Failed to update order with Stripe session ID');
      });
    } catch (stripeError) {
      logger.error({ error: stripeError.message, stack: stripeError.stack, orderId: order.id }, 'Stripe error creating checkout session');
      try {
        await orderService.updateOrderStatus(order.id, 'failed', {
          error: stripeError.message,
        });
      } catch (updateError) {
        logger.error({ error: updateError.message, orderId: order.id }, 'Error updating order status to failed');
      }
      throw stripeError;
    }

    logger.info({ sessionId: session.id, orderId: order.id }, 'Checkout session created successfully');
    
    if (!res.headersSent) {
      res.json({ 
        sessionId: session.id,
        orderId: order.id,
        url: session.url 
      });
      logger.debug('Response sent to frontend');
    } else {
      logger.warn('Response already sent, cannot send checkout session response');
    }
  } catch (error) {
    logger.error({ 
      error: error.message, 
      name: error.name, 
      stack: error.stack 
    }, 'Error creating checkout session');
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to create checkout session',
        message: error.message || 'Unknown error occurred'
      });
    } else {
      logger.error('Cannot send error response - headers already sent');
    }
  }
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

// Apply rate limiting to all other routes (except webhook which is already registered)
// Note: Webhook route is registered before this, so it's not rate limited
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Initialize database on first request (for serverless) - must be before routes
if (isServerless) {
  let dbInitialized = false;
  async function ensureDatabaseInitialized() {
    if (!dbInitialized) {
      try {
        await initializeDatabase();
        logger.info('Database connection initialized');
        dbInitialized = true;
      } catch (error) {
        logger.error({ error: error.message }, 'Failed to initialize database connection');
        // Continue anyway - some adapters might not need explicit connection
        dbInitialized = true; // Mark as attempted to prevent infinite retries
      }
    }
  }
  
  app.use(async (req, res, next) => {
    await ensureDatabaseInitialized();
    next();
  });
}

// Root endpoint - API information
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'GrowWise Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      testimonials: '/api/testimonials',
      contact: '/api/contact',
      search: '/api/search',
      enrollment: '/api/enrollment',
      payment: '/api/payment'
    },
    timestamp: new Date().toISOString()
  });
});

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

// Payment routes - mount after webhook route to avoid conflicts
// The webhook route is already registered directly on app at /api/payment/webhook
// Mount payment router - this will handle /api/payment/* routes except /webhook
// IMPORTANT: Make sure this is after body parsing middleware so req.body is available
app.use('/api/payment', paymentRoutes);

// Debug: Log route registration in development
if (process.env.NODE_ENV !== 'production' && !isServerless) {
  setTimeout(() => {
    logger.info('Registered routes:');
    app._router.stack.forEach((middleware, i) => {
      if (middleware.route) {
        const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
        logger.info(`  ${methods} ${middleware.route.path}`);
      } else if (middleware.name === 'router') {
        logger.info(`  Router mounted at: ${middleware.regexp}`);
      }
    });
  }, 100);
}

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

// Start server (only if not in serverless environment)
if (!isServerless) {
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
}

// Export app for Vercel serverless functions
module.exports = app;
