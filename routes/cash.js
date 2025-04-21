const express = require('express');
const router = express.Router();
const db = require('../db'); // uses your existing MySQL connection

// Deposit Cash
router.post('/deposit', async (req, res) => {
  const { amount } = req.body;
  const userId = req.session.user?.id;

  if (!userId || amount <= 0) return res.status(400).send('Invalid deposit');

  try {
    await db.query(
      'UPDATE users SET cashBalance = cashBalance + ? WHERE id = ?',
      [parseFloat(amount), userId]
    );
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error during deposit');
  }
});

// Withdraw Cash
router.post('/withdraw', async (req, res) => {
  const { amount } = req.body;
  const userId = req.session.user?.id;

  if (!userId || amount <= 0) return res.status(400).send('Invalid withdrawal');

  try {
    const [rows] = await db.query(
      'SELECT cashBalance FROM users WHERE id = ?',
      [userId]
    );
    const currentBalance = rows[0]?.cashBalance || 0;

    if (currentBalance < amount) {
      return res.status(400).send('Insufficient funds');
    }

    await db.query(
      'UPDATE users SET cashBalance = cashBalance - ? WHERE id = ?',
      [parseFloat(amount), userId]
    );

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error during withdrawal');
  }
});

module.exports = router;