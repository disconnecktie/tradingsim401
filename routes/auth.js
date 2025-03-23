const express = require('express');
const router = express.Router();

// GET /login (home page)
router.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', { title: 'Login' });
});

// GET /register
router.get('/register', (req, res) => {
  res.render('register', { title: 'Create Account' });
});

// POST /login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    req.session.user = { email }; // Simulated login
    return res.redirect('/dashboard');
  }
  res.render('login', { title: 'Login', error: 'Invalid credentials' });
});

// POST /register
router.post('/register', (req, res) => {
  const { fullname, email, password, confirm } = req.body;
  if (!fullname || !email || !password || password !== confirm) {
    return res.render('register', {
      title: 'Create Account',
      error: 'Please fill all fields and ensure passwords match.'
    });
  }
  req.session.user = { name: fullname, email };
  res.redirect('/dashboard');
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;