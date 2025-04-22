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
  const user = req.session.user || null;
  res.locals.user = user;
  res.locals.error = null;
  res.locals.query = '';

  // Dynamically set dashboardPath
  res.locals.dashboardPath =
    user?.role === 'superadmin' ? '/admin/control-center' :
    user?.role === 'admin' ? '/admin' :
    '/dashboard';

  next();
});

// Flash message support
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Route imports
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const pagesRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api'); // API routes for stock/history
const cashRoutes = require('./routes/cash');


// Route mounting
app.use('/', authRoutes);         // login, register, logout
app.use('/dashboard', dashboardRoutes); // dashboard
app.use('/', pagesRoutes);        // pages like search, ticker, admin
app.use('/', apiRoutes);          // API: /api/stock/:symbol, etc.
app.use('/cash', cashRoutes);

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