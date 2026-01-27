const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/v1/auth/google',
  method: 'GET',
  headers: {
    'User-Agent': 'Test Script'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  if (res.statusCode === 302) {
    console.log('✅ OAuth redirect working! Redirecting to:', res.headers.location);
  } else {
    console.log('❌ Unexpected status code');
  }

  res.on('data', (chunk) => {
    console.log('Response body:', chunk.toString());
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();