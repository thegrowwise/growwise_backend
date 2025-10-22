# GrowWise Backend Service

A Node.js backend service that fetches Google Reviews and serves them as testimonials with intelligent caching.

## Features

- 🔍 **Google Reviews Integration**: Fetches real reviews from Google Places API
- 📦 **Smart Caching**: Redis or in-memory caching with configurable TTL
- 🚀 **High Performance**: Optimized for speed with fallback mechanisms
- 🛡️ **Security**: Rate limiting, CORS, and input validation
- 📊 **Monitoring**: Health checks and cache statistics
- 🔄 **Auto-refresh**: Force refresh capabilities

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Setup

Copy the example environment file and configure it:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Google Places API Configuration
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
GOOGLE_PLACE_ID=your_google_place_id_here

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Cache Configuration
CACHE_TTL=3600
CACHE_MAX_ITEMS=1000

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

### 3. Get Google Places API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Places API**
4. Create credentials (API Key)
5. Get your Place ID from Google Maps

### 4. Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### Get Testimonials
```
GET /api/testimonials?limit=10&offset=0&forceRefresh=false
```

**Response:**
```json
{
  "success": true,
  "data": {
    "testimonials": [...],
    "pagination": {
      "total": 25,
      "limit": 10,
      "offset": 0,
      "hasMore": true
    },
    "cached": true
  },
  "meta": {
    "count": 10,
    "limit": 10,
    "offset": 0,
    "cached": true,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Force Refresh Testimonials
```
POST /api/testimonials/refresh
```

### Get Cache Statistics
```
GET /api/testimonials/stats
```

### Health Check
```
GET /health
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `GOOGLE_PLACES_API_KEY` | Google Places API key | Required |
| `GOOGLE_PLACE_ID` | Google Place ID | Required |
| `CACHE_TYPE` | Cache type: 'memory' or 'redis' | `memory` |
| `CACHE_TTL` | Cache time-to-live (seconds) | `3600` |
| `REDIS_URL` | Redis connection URL (when CACHE_TYPE=redis) | Optional |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |

### Cache Configuration

The service supports two caching strategies:

1. **Memory Cache** (Default)
   - Set `CACHE_TYPE=memory`
   - Fast, in-memory caching
   - Good for development and small deployments
   - Data lost on restart

2. **Redis Cache** (Production)
   - Set `CACHE_TYPE=redis` and `REDIS_URL`
   - Persistent, distributed caching
   - Better for production environments
   - Data persists across restarts

See [CACHE_CONFIGURATION.md](./CACHE_CONFIGURATION.md) for detailed configuration options.

## Error Handling

The service includes comprehensive error handling:

- **API Errors**: Graceful handling of Google API failures
- **Network Errors**: Timeout and connection error handling
- **Cache Errors**: Fallback to memory cache if Redis fails
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Request parameter validation

## Monitoring

### Health Check
```bash
curl http://localhost:3001/health
```

### Cache Statistics
```bash
curl http://localhost:3001/api/testimonials/stats
```

## Development

### Running Tests
```bash
npm test
```

### Code Structure
```
src/
├── server.js              # Main server file
├── routes/
│   └── testimonials.js    # Testimonials API routes
├── services/
│   ├── testimonialsService.js    # Business logic
│   ├── googleReviewsService.js   # Google API integration
│   └── cacheService.js          # Caching logic
├── middleware/
│   ├── errorHandler.js    # Error handling
│   └── validation.js       # Input validation
└── utils/
    └── reviewTransformer.js # Data transformation
```

## Deployment

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables for Production
- Set `NODE_ENV=production`
- Configure proper `CORS_ORIGIN`
- Use Redis for caching
- Set up monitoring and logging

## Troubleshooting

### Common Issues

1. **Google API Errors**
   - Verify API key is correct
   - Check if Places API is enabled
   - Ensure billing is set up

2. **Cache Issues**
   - Check Redis connection
   - Verify cache TTL settings
   - Monitor cache statistics

3. **CORS Issues**
   - Update `CORS_ORIGIN` environment variable
   - Check frontend URL configuration

## Support

For issues and questions:
- Check the logs for detailed error messages
- Verify environment configuration
- Test API endpoints with curl or Postman
