const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '0';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pharmacy_db?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-32-characters-long';

const app = require('../dist/app.js').default;

const request = async (baseUrl, path, options) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { status: response.status, body, headers: response.headers };
};

const run = async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await request(baseUrl, '/api/v1/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.data.status, 'UP');
    assert.equal(health.body.meta.message, 'System health operational');

    const docs = await request(baseUrl, '/api/v1/docs');
    assert.equal(docs.status, 200);
    assert.ok(docs.body.data.openapi);

    const openapi = await request(baseUrl, '/api/v1/docs/openapi.json');
    assert.equal(openapi.status, 200);
    assert.equal(openapi.body.openapi, '3.0.3');

    const authMe = await request(baseUrl, '/api/v1/auth/me');
    assert.equal(authMe.status, 401);
    assert.equal(authMe.body.error.code, 'UNAUTHENTICATED');

    const protectedEndpoint = await request(baseUrl, '/api/v1/products');
    assert.equal(protectedEndpoint.status, 401);
    assert.equal(protectedEndpoint.body.error.code, 'UNAUTHENTICATED');

    const notFound = await request(baseUrl, '/api/v1/not-a-route');
    assert.equal(notFound.status, 404);
    assert.equal(notFound.body.error.code, 'NOT_FOUND');

    console.log('HTTP smoke passed.');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
