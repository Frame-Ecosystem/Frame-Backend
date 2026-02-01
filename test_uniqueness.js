const http = require('http');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', err => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testServiceUniqueness() {
  try {
    console.log('Testing case-insensitive service name uniqueness...');

    // First, get service categories
    const categoriesResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/v1/admin/service-categories',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (categoriesResponse.statusCode !== 200) {
      console.log('❌ Failed to get categories:', categoriesResponse.data);
      return;
    }

    const categories = categoriesResponse.data.data;
    if (!categories || categories.length === 0) {
      console.log('❌ No service categories found');
      return;
    }

    const categoryId = categories[0]._id;
    console.log('Using category ID:', categoryId);

    // Try to create a service with name "Test Service"
    const createResponse1 = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/v1/admin/services',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        name: 'Test Service',
        categoryId: categoryId,
        baseDuration: 30,
      },
    );

    if (createResponse1.statusCode === 201) {
      console.log('✅ Successfully created service "Test Service"');
    } else {
      console.log('❌ Failed to create first service:', createResponse1.data);
      return;
    }

    // Try to create another service with name "test service" (different case)
    const createResponse2 = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/v1/admin/services',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        name: 'test service',
        categoryId: categoryId,
        baseDuration: 30,
      },
    );

    if (createResponse2.statusCode === 409) {
      console.log('✅ Case-insensitive uniqueness working! "test service" was rejected');
    } else if (createResponse2.statusCode === 201) {
      console.log('❌ Case-insensitive uniqueness NOT working! "test service" was created');
    } else {
      console.log('❌ Unexpected response:', createResponse2.statusCode, createResponse2.data);
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testServiceUniqueness();
