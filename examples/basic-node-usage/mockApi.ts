import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 4000;

// --- Middlewares ---
app.use(cors()); // Allow requests from any origin
app.use(express.json()); // Parse JSON request bodies

// --- In-Memory Database ---
let users = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

// --- API Routes ---

// GET /users -> Get all users
app.get('/users', (req, res) => {
  console.log(`[SERVER] GET /users -> Returning ${users.length} users.`);
  res.status(200).json(users);
});

// GET /users/:id -> Get a single user by ID
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  const user = users.find(u => u.id === id);

  if (user) {
    console.log(`[SERVER] GET /users/${id} -> Found user:`, user.name);
    res.status(200).json(user);
  } else {
    console.log(`[SERVER] GET /users/${id} -> User not found.`);
    res.status(404).json({ message: 'User not found' });
  }
});

// POST /users -> Create a new user
app.post('/users', (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    console.log(`[SERVER] POST /users -> Bad request, missing name or email.`);
    return res.status(400).json({ message: 'Name and email are required' });
  }

  const newUser = {
    id: String(Date.now()),
    name,
    email,
  };
  users.push(newUser);
  console.log(`[SERVER] POST /users -> Created user:`, newUser);
  res.status(201).json(newUser);
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
});
