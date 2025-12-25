const express = require('express');
const cookieParser = require('cookie-parser');
const adminRoutes = require('./routes/adminRoutes');
const controllers = require('./controllers/adminController')
const cors = require('cors');

const app = express();

app.use(
  cors({
    origin: [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://your-frontend-domain.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
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
