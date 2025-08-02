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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    console.log(`Proxying ${req.method} ${parsedUrl.pathname}`);
    
    // Remove /api prefix and forward to Miro
    const miroPath = parsedUrl.pathname.replace('/api', '');
    
    const options = {
      hostname: 'api.miro.com',
      port: 443,
      path: '/v2' + miroPath + parsedUrl.search,
      method: req.method,
      headers: {
        ...req.headers,
        'host': 'api.miro.com',
        'origin': undefined,
        'referer': undefined
      }
    };
    
    // Remove problematic headers
    delete options.headers['host'];
    delete options.headers['connection'];
    
    const proxyReq = https.request(options, (proxyRes) => {
      console.log(`Miro responded with ${proxyRes.statusCode}`);
      
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        ...corsHeaders
      });
      
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err);
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ error: 'Proxy error' }));
    });
    
    req.pipe(proxyReq);
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