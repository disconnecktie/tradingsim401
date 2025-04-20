const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // For parsing JSON requests (if needed)
app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: true
}));

// View engine & static assets
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(express.static('public'));

// Global view variables
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.error = null;
  res.locals.query = '';
  next();
});

// Route imports
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const pagesRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api'); // ✅ API routes for stock/history

// Route mounting
app.use('/', authRoutes);         // login, register, logout
app.use('/dashboard', dashboardRoutes); // dashboard
app.use('/', pagesRoutes);        // pages like search, ticker, admin
app.use('/', apiRoutes);          // ✅ API: /api/stock/:symbol, etc.

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

// Database connection test
const db = require('./db');
db.query('SELECT 1')
  .then(() => console.log('✅ DB connection successful'))
  .catch(err => console.error('❌ DB connection failed:', err));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});