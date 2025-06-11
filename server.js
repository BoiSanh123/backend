// server.js
const express = require('express');
const app = express();
const apiRoutes = require('./routes/api'); // Import các API từ routes
require('dotenv').config(); // Load biến môi trường từ .env

// Middleware
app.use(express.json()); // Cho phép nhận JSON từ client

// Route chính
app.use('/api', apiRoutes);

// Lắng nghe server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
