process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let server;
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Override Mongo URI for tests
  process.env.MONGO_URI = uri + 'testdb';

  // Import AFTER env vars are set
  const appModule = require('../../src/app.js');
  app = appModule.app;
  server = appModule.server;

  // Ensure mongoose is connected
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri + 'testdb');
  }
});

afterEach(async () => {
  // Clean database after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongod.stop();

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('Name API Routes', () => {
  test('GET / should return index.html with 200', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  test('GET /names should return empty array initially', async () => {
    const res = await request(app).get('/names');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('POST /names should create a new name', async () => {
    const res = await request(app)
      .post('/names')
      .send({ name: 'Masum' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Saved');

    const getRes = await request(app).get('/names');
    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0].name).toBe('Masum');
  });

  test('POST /names should reject empty name', async () => {
    const res = await request(app)
      .post('/names')
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Name required');
  });

  test('DELETE /names/:id should delete a name', async () => {
    await request(app)
      .post('/names')
      .send({ name: 'Temporary' });

    const getRes = await request(app).get('/names');
    const id = getRes.body[0]._id;

    const deleteRes = await request(app).delete(`/names/${id}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('Deleted');

    const finalRes = await request(app).get('/names');
    expect(finalRes.body).toHaveLength(0);
  });

  test('GET /metrics should return Prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('process_cpu_user_seconds_total');
    expect(res.text).toContain('nodejs_eventloop_lag_seconds');
  });
});
