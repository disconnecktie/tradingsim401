const express = require('express');
const router = express.Router();
const db = require('../db');
const checkAuth = (req, res, next) => req.session.user ? next() : res.redirect('/');

router.get('/api/stock/:symbol', checkAuth, async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
  
    try {
      const [rows] = await db.query(
        'SELECT * FROM stocks WHERE ticker_symbol = ?',
        [symbol]
      );
  
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Stock not found' });
      }
  
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch stock data' });
    }
});

// API: Get historical price data
router.get('/api/history/:symbol', checkAuth, async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    try {
      const [rows] = await db.query(
        'SELECT price, recorded_at FROM stock_history WHERE ticker_symbol = ? ORDER BY recorded_at ASC',
        [symbol]
      );
      res.json(rows);
    } catch (err) {
      console.error('❌ Failed to fetch history:', err.message);
      res.status(500).json({ error: 'Failed to fetch history data' });
    }
});

// API: Portfolio History
router.get('/api/portfolio/history', checkAuth, async (req, res) => {
    const userId = req.session.user.id;
  
    try {
      const [transactions] = await db.query(
        `SELECT transaction_time, quantity, price_at_transaction
         FROM user_transactions
         WHERE user_id = ? AND transaction_type = 'buy'
         ORDER BY transaction_time ASC`,
        [userId]
      );
  
      let total = 0;
      const history = transactions.map(tx => {
        total += tx.quantity * tx.price_at_transaction;
        return {
          date: tx.transaction_time,
          value: total
        };
      });
  
      res.json(history);
    } catch (err) {
      console.error('❌ Failed to build portfolio history:', err);
      res.status(500).json({ error: 'Failed to build graph data' });
    }
});
  

module.exports = router;