const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware to protect routes
function checkAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/');
}

// GET /dashboard
router.get('/', checkAuth, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [holdings] = await db.query(
      `SELECT uh.ticker_symbol, uh.quantity, s.current_price,
              MAX(ut.transaction_time) AS last_purchase_time
       FROM user_holdings uh
       JOIN stocks s ON uh.ticker_symbol = s.ticker_symbol
       LEFT JOIN user_transactions ut
         ON ut.ticker_symbol = uh.ticker_symbol
        AND ut.user_id = uh.user_id
        AND ut.transaction_type = 'buy'
       WHERE uh.user_id = ?
       GROUP BY uh.ticker_symbol, uh.quantity, s.current_price`,
      [userId]
    );

    // Calculate total portfolio value
    const totalValueNow = holdings.reduce(
      (sum, h) => sum + (h.quantity * h.current_price),
      0
    );

    // Get 24h-ago prices
    let totalValue24hAgo = 0;
    if (holdings.length > 0) {
      const [oldPrices] = await db.query(
        `SELECT ticker_symbol, price
         FROM stock_history
         WHERE recorded_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         AND ticker_symbol IN (${holdings.map(() => '?').join(',')})
         GROUP BY ticker_symbol
         ORDER BY recorded_at DESC`,
        holdings.map(h => h.ticker_symbol)
      );

      const priceMap24h = Object.fromEntries(
        oldPrices.map(p => [p.ticker_symbol, p.price])
      );

      totalValue24hAgo = holdings.reduce((sum, h) => {
        const oldPrice = priceMap24h[h.ticker_symbol] || h.current_price;
        return sum + (h.quantity * oldPrice);
      }, 0);
    }

    const percentChange = totalValue24hAgo === 0
      ? 0
      : ((totalValueNow - totalValue24hAgo) / totalValue24hAgo) * 100;

    res.render('dashboard', {
      title: 'Dashboard',
      user: req.session.user,
      holdings,
      totalValueNow,
      percentChange
    });
  } catch (err) {
    console.error('❌ Dashboard error:', err);
    res.render('dashboard', {
      title: 'Dashboard',
      user: req.session.user,
      holdings: [],
      totalValueNow: 0,
      percentChange: 0,
      error: 'Could not load your portfolio.'
    });
  }
});

module.exports = router;