// services/auth-service/index.js
import express from 'express';
import { register, login } from './controllers/authControllers.js';

const app = express();
app.use(express.json());

app.post('/register', register);
app.post('/login', login);

app.listen(3001, () => console.log('🔐 Auth Service running on port 3001'));