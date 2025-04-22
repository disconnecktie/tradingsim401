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

// API: Get historical price data with optional range filtering
router.get('/api/history/:symbol', checkAuth, async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const range = req.query.range || '30d';

    let interval;
    if (range === '1d') interval = '1 DAY';
    else if (range === '5d') interval = '5 DAY';
    else interval = '30 DAY';

    try {
      const [rows] = await db.query(
        `SELECT price, recorded_at FROM stock_history 
         WHERE ticker_symbol = ? AND recorded_at >= NOW() - INTERVAL ${interval}
         ORDER BY recorded_at ASC`,
        [symbol]
      );
      res.json(rows);
    } catch (err) {
      console.error('❌ Failed to fetch history:', err.message);
      res.status(500).json({ error: 'Failed to fetch history data' });
    }
});

router.get('/api/portfolio/history', checkAuth, async (req, res) => {
    const userId = req.session.user.id;
    const range = req.query.range || '1d';
  
    const now = require('luxon').DateTime.now();
    let from;
    let granularity;
  
    if (range === '30d') {
      from = now.minus({ days: 30 });
      granularity = '1d';
    } else if (range === '5d') {
      from = now.minus({ days: 5 });
      granularity = '1h';
    } else {
      from = now.startOf('day');
      granularity = '10m';
    }
  
    try {
      const [holdings] = await db.query(
        'SELECT ticker_symbol, quantity FROM user_holdings WHERE user_id = ?',
        [userId]
      );
      if (holdings.length === 0) return res.json([]);
  
      const tickerList = holdings.map(h => h.ticker_symbol);
  
      const [history] = await db.query(
        `SELECT ticker_symbol, price, recorded_at
         FROM stock_history
         WHERE ticker_symbol IN (${tickerList.map(() => '?').join(',')})
         AND recorded_at >= ?
         ORDER BY recorded_at ASC`,
        [...tickerList, from.toSQL()]
      );
  
      const { DateTime } = require('luxon');
      const pricesByTime = {};
  
      for (const row of history) {
        const dt = DateTime.fromJSDate(row.recorded_at);
        let rounded;
  
        if (granularity === '1d') {
          rounded = dt.startOf('day').toISO();
        } else if (granularity === '1h') {
          rounded = dt.startOf('hour').toISO();
        } else {
          const mins = Math.floor(dt.minute / 10) * 10;
          rounded = dt.set({ minute: mins, second: 0, millisecond: 0 }).toISO();
        }
  
        if (!pricesByTime[rounded]) pricesByTime[rounded] = {};
        pricesByTime[rounded][row.ticker_symbol] = row.price;
      }
  
      const portfolio = Object.entries(pricesByTime).map(([timestamp, priceMap]) => {
        let total = 0;
        for (const h of holdings) {
          const p = priceMap[h.ticker_symbol];
          if (p) total += p * h.quantity;
        }
        return { date: timestamp, value: parseFloat(total.toFixed(2)) };
      });
  
      res.json(portfolio);
    } catch (err) {
      console.error('❌ Failed to build portfolio history:', err);
      res.status(500).json({ error: 'Failed to build graph data' });
    }
});

module.exports = router;