import express from 'express';
import morgan from 'morgan';
import { Sequelize, DataTypes } from 'sequelize';
import { createClient } from 'redis';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(morgan('combined'));
app.use(express.json());

// Initialize Redis client with dynamic host and port
console.log('Initializing Redis client...');

const redisHost = process.env.REDIS_HOST || 'localhost'; // Get Redis host from environment
const redisPort = process.env.REDIS_PORT || 6379;       // Get Redis port from environment

console.table([{
  redis_host: process.env.REDIS_HOST,
  redis_port: process.env.REDIS_PORT,
  db_host: process.env.POSTGRES_HOST,
  db_name: process.env.POSTGRES_DB,
  db_users: process.env.POSTGRES_USER,
  db_pass: process.env.POSTGRES_PASSWORD,
}]);

const redisClient = createClient({
  url: `redis://${redisHost}:${redisPort}`  // Combine host and port into the Redis URL
});

(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis successfully!');
  } catch (err) {
    console.error('Redis connection error:', err);
  }
})();

// Initialize Sequelize for PostgreSQL
const sequelize = new Sequelize(
  process.env.POSTGRES_DB, // Database name from environment variable
  process.env.POSTGRES_USER, // Username from environment variable
  process.env.POSTGRES_PASSWORD, // Password from environment variable
  {
    host: process.env.POSTGRES_HOST || 'localhost', // PostgreSQL hostname (default localhost)
    dialect: 'postgres',
    port: process.env.POSTGRES_PORT || 5432, // Port (default 5432)
  }
);

// Define User model
const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
});

// Sync the database
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection to PostgreSQL has been established successfully.');
    await sequelize.sync();
    console.log('Database synchronized.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
})();

// Endpoints

// Health Check Route
app.get('/', (req, res) => {
  res.send('Hello World from develop!');
});

// Get Users Route with Cache
app.get('/users', async (req, res) => {
  try {
    // Try fetching users from the cache
    const cachedUsers = await redisClient.get('users');

    if (cachedUsers) {
      return res.json({ source: 'cache', users: JSON.parse(cachedUsers) });
    }

    // If cache is empty, fetch from database
    const users = await User.findAll();
    await redisClient.setEx('users', 3600, JSON.stringify(users)); // Cache for 1 hour
    res.json({ source: 'database', users });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Create User Route
app.post('/users', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).send('Name and email are required');
  }

  try {
    // Create a new user in the database
    const user = await User.create({ name, email });

    // Invalidate the cache after inserting a new user
    await redisClient.del('users'); // Invalidate the cache

    res.status(201).json(user);
  } catch (error) {
    console.error('Database insertion error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
