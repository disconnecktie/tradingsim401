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

  if (!userId || amount <= 0) {
    req.session.flash = 'Invalid withdrawal amount.';
    return res.redirect('/cash');
  }

  try {
    const [rows] = await db.query(
      'SELECT cashBalance FROM users WHERE id = ?',
      [userId]
    );
    const currentBalance = parseFloat(rows[0]?.cashBalance || 0);

    if (currentBalance < parseFloat(amount)) {
      req.session.flash = 'Insufficient funds.';
      return res.redirect('/cash');
    }

    await db.query(
      'UPDATE users SET cashBalance = cashBalance - ? WHERE id = ?',
      [parseFloat(amount), userId]
    );

    req.session.flash = `Successfully withdrew $${parseFloat(amount).toFixed(2)}.`;
    res.redirect('/cash');
  } catch (err) {
    console.error(err);
    req.session.flash = 'Withdrawal failed. Try again.';
    res.redirect('/cash');
  }
});

module.exports = router;