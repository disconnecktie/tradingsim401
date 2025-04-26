const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db'); // make sure path is correct
const router = express.Router();

// GET /login
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

// POST /register
router.post('/register', async (req, res) => {
  const { fullname, email, password, confirm } = req.body;

  if (!fullname || !email || !password || password !== confirm) {
    return res.render('register', {
      title: 'Create Account',
      error: 'Please fill all fields and ensure passwords match.'
    });
  }

  try {
    const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.render('register', {
        title: 'Create Account',
        error: 'Email is already registered.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (fullname, email, password_hash, cashBalance, is_active) VALUES (?, ?, ?, ?, ?)',
      [fullname, email, hashedPassword, 0.00, true]
    );    

    req.session.user = { name: fullname, email, role: 'user' };
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('register', {
      title: 'Create Account',
      error: 'An error occurred. Please try again.'
    });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (results.length === 0) {
      return res.render('login', { title: 'Login', error: 'Invalid credentials.' });
    }

    const user = results[0];
    // 🛡️ New: Check if user is active
    if (!user.is_active) {
      return res.render('login', { title: 'Login', error: 'Your account has been deactivated. Contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.render('login', { title: 'Login', error: 'Invalid credentials.' });
    }

    req.session.user = {
      id: user.id,
      name: user.fullname,
      email: user.email,
      role: user.role
    };

    // 🔁 Role-based redirect
    if (user.role === 'superadmin') {
      return res.redirect('/admin/control-center');
    } else if (user.role === 'admin') {
      return res.redirect('/admin');
    } else {
      return res.redirect('/dashboard');
    }

  } catch (err) {
    console.error(err);
    res.render('login', { title: 'Login', error: 'An error occurred. Please try again.' });
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;