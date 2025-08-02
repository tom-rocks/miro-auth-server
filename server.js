const https = require('https');
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3003;
const MIRO_CLIENT_ID = '3458764636252115791';
const MIRO_CLIENT_SECRET = '1hTnhLh6yzegpOuZCSTczV8JZm2ol62E';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Access-Control-Expose-Headers': '*'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }
  
  // Handle token exchange
  if (parsedUrl.pathname === '/token' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { code, redirect_uri } = JSON.parse(body);
        
        console.log('Exchanging code for token...');
        
        const tokenData = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: MIRO_CLIENT_ID,
          client_secret: MIRO_CLIENT_SECRET,
          code: code,
          redirect_uri: redirect_uri
        }).toString();
        
        const options = {
          hostname: 'api.miro.com',
          port: 443,
          path: '/v1/oauth/token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': tokenData.length
          }
        };
        
        const tokenReq = https.request(options, (tokenRes) => {
          let responseBody = '';
          tokenRes.on('data', chunk => responseBody += chunk);
          tokenRes.on('end', () => {
            res.writeHead(tokenRes.statusCode, {
              ...corsHeaders,
              'Content-Type': 'application/json'
            });
            res.end(responseBody);
          });
        });
        
        tokenReq.on('error', (err) => {
          console.error('Token exchange error:', err);
          res.writeHead(500, corsHeaders);
          res.end(JSON.stringify({ error: 'Token exchange failed' }));
        });
        
        tokenReq.write(tokenData);
        tokenReq.end();
        
      } catch (error) {
        console.error('Request error:', error);
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }
  
  // Handle Miro API proxy
  if (parsedUrl.pathname.startsWith('/api/')) {
    console.log(`Proxying ${req.method} ${req.url}`);
    console.log('Authorization header present:', !!req.headers.authorization);
    
    // Remove /api prefix and forward to Miro
    // Use req.url to preserve the original encoding
    const originalPath = req.url.split('?')[0];
    const miroPath = originalPath.replace('/api', '');
    const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    
    // Only forward necessary headers
    const headers = {};
    if (req.headers.authorization) {
      headers.authorization = req.headers.authorization;
    }
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'];
    }
    headers.accept = 'application/json';
    
    const options = {
      hostname: 'api.miro.com',
      port: 443,
      path: '/v2' + miroPath + queryString,
      method: req.method,
      headers: headers
    };
    
    const proxyReq = https.request(options, (proxyRes) => {
      console.log(`Miro responded with ${proxyRes.statusCode} for ${options.path}`);
      
      // Collect the response body for error logging
      let responseBody = '';
      proxyRes.on('data', chunk => responseBody += chunk);
      
      proxyRes.on('end', () => {
        if (proxyRes.statusCode >= 400) {
          console.error('Miro API Error:', responseBody);
        }
        
        // Always include CORS headers
        const responseHeaders = {
          ...corsHeaders,
          'content-type': proxyRes.headers['content-type'] || 'application/json'
        };
        
        res.writeHead(proxyRes.statusCode, responseHeaders);
        res.end(responseBody);
      });
    });
    
    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err);
      res.writeHead(500, {
        ...corsHeaders,
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
    });
    
    // Forward request body if present
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        if (body) {
          options.headers['content-length'] = Buffer.byteLength(body);
          proxyReq.setHeader('content-length', Buffer.byteLength(body));
          proxyReq.write(body);
        }
        proxyReq.end();
      });
    } else {
      proxyReq.end();
    }
    
    return;
  }
  
  // Default response
  res.writeHead(404, corsHeaders);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`🔐 Miro Auth & API Proxy Server running on port ${PORT}`);
  console.log(`📍 Token endpoint: http://localhost:${PORT}/token`);
  console.log(`📍 API proxy: http://localhost:${PORT}/api/*`);
});