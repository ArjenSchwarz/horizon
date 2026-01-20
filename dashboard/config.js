/**
 * Horizon Dashboard Configuration
 *
 * Edit API_URL before deployment to point to your Horizon API.
 * The API key is stored in browser localStorage after initial setup.
 */
const CONFIG = {
  // API endpoint URL - update this for your deployment
  // For local development: 'http://localhost:8787'
  // For Cloudflare Workers: 'https://horizon-api.your-subdomain.workers.dev'
  API_URL: 'http://localhost:8787',

  // Auto-refresh interval in milliseconds (default: 5 minutes)
  REFRESH_INTERVAL: 5 * 60 * 1000,

  // Cache key for localStorage
  CACHE_KEY: 'horizon_cache',

  // API key storage key for localStorage
  API_KEY_STORAGE_KEY: 'horizon_api_key',
};
