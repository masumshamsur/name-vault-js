const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const client = require('prom-client');  // <-- Add this

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Collect default Node.js / process metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics();  // <-- Add this (uses default registry and interval)

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mydb')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB error:', err));

// Schema
const nameSchema = new mongoose.Schema({ name: String }, { versionKey: false });
const Name = mongoose.model('Name', nameSchema);

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/names', async (req, res) => {
  const names = await Name.find();
  res.json(names);
});

app.post('/names', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  await Name.create({ name });
  res.status(201).json({ message: 'Saved' });
});

app.delete('/names/:id', async (req, res) => {
  await Name.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// Expose Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {  // <-- Add this route
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

let server;
// Only start server if not running in tests
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(port, () => {
    console.log(`App running on http://localhost:${port}`);
  });
}

module.exports = { app, server }; // ← ADD THIS LINE (for testing)