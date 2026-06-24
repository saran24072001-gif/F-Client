import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: `https://backend-server-production-63ad.up.railway.app/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor to inject the token from localStorage
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cms_token') || sessionStorage.getItem('cms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Transparent GET Request Deduplicator
// This prevents concurrent identical GET requests from firing duplicate network requests.
const originalGet = axiosInstance.get;
const pendingGetRequests = new Map();

axiosInstance.get = function (url, config) {
  // Only deduplicate standard GET requests (e.g., skip blob/attachments response types)
  const isBlob = config && config.responseType === 'blob';
  if (isBlob) {
    return originalGet.call(this, url, config);
  }

  const key = `${url}:${JSON.stringify(config || '')}`;
  if (pendingGetRequests.has(key)) {
    console.log(`[Deduplicator] Deduplicating active GET request: ${url}`);
    return pendingGetRequests.get(key);
  }

  const promise = originalGet.call(this, url, config)
    .finally(() => {
      pendingGetRequests.delete(key);
    });

  pendingGetRequests.set(key, promise);
  return promise;
};

export default axiosInstance;
