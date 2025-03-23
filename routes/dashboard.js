const express = require('express');
const router = express.Router();

// Middleware to protect routes
function checkAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/');
}

// GET /dashboard
router.get('/', checkAuth, (req, res) => {
  res.render('dashboard', {
    title: 'Dashboard',
    user: req.session.user
  });
});

module.exports = router;