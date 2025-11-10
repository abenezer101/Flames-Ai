import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { v1Router } from './api/v1/routes';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors()); // In production, configure this with a specific origin
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));


// API Routes
app.get('/', (req, res) => {
  res.send('Flames Backend is running!');
});

app.use('/api/v1', v1Router);

// Start Server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
