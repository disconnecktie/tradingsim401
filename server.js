const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(express.static('public'));

// Make session user available in all views
app.use((req, res, next) => {
	res.locals.user = req.session.user;
	next();
});

// Use routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const pagesRoutes = require('./routes/pages');

app.use('/', authRoutes);        // login, register, logout
app.use('/dashboard', dashboardRoutes);  // user home
app.use('/', pagesRoutes);       // search, ticker, admin pages

// Catch-all 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));