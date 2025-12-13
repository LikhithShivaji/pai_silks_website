const express = require('express');
const cookieParser = require('cookie-parser');
const adminRoutes = require('./routes/adminRoutes');
const controllers = require('./controllers/adminController')
const cors = require('cors');

const app = express();

app.use(
  cors({
    origin: true, // Allow any origin (you can replace this with a specific origin)
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  })
);

app.use(express.json());
app.use(cookieParser());

app.post('/api/admin-login', controllers.adminLogin);

// Routes
app.use('/api', adminRoutes); // Prefix routes with /api

const PORT = 3006;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
