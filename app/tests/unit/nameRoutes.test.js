const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// We'll import the app after setting up in-memory MongoDB
let app;
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Temporarily override env for tests
  process.env.MONGO_URI = uri + 'testdb';

  // Import app after env is set
  const appModule = require('../../src/app.js');
  app = appModule; // assuming app is default export? No — fix below

  // Wait for mongoose to connect
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri + 'testdb');
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  // Clean database after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
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

    // Verify it was saved
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
    // First create one
    const createRes = await request(app)
      .post('/names')
      .send({ name: 'Temporary' });

    const getRes = await request(app).get('/names');
    const id = getRes.body[0]._id;

    // Now delete it
    const deleteRes = await request(app).delete(`/names/${id}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('Deleted');

    // Verify it's gone
    const finalRes = await request(app).get('/names');
    expect(finalRes.body).toHaveLength(0);
  });

  test('GET /metrics should return Prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain; version=0.0.4; charset=utf-8');
    expect(res.text).toContain('process_cpu_user_seconds_total');
    expect(res.text).toContain('nodejs_eventloop_lag_seconds');
  });
});