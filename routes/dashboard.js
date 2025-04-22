const express = require('express');
const router = express.Router();
const db = require('../db');
const { DateTime } = require('luxon'); // 🆕 Add Luxon for time zone support

function checkAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/');
}

router.get('/', checkAuth, async (req, res) => {
  const userId = req.session.user.id;

  try {
    // ✅ Fetch full user (includes cashBalance)
    const [userRows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    const fullUser = userRows[0];
    fullUser.cashBalance = parseFloat(fullUser.cashBalance);

    // ✅ Fetch market hours
    const [marketRows] = await db.query('SELECT * FROM market_hours LIMIT 1');
    const market = marketRows[0];

    const now = DateTime.now().setZone(market.timezone || 'America/New_York');
    const marketOpen = DateTime.fromFormat(market.open_time, 'HH:mm:ss', { zone: market.timezone });
    const marketClose = DateTime.fromFormat(market.close_time, 'HH:mm:ss', { zone: market.timezone });

    // 🆕 Check for holiday
    const todayDate = now.toISODate(); // YYYY-MM-DD
    const [holidays] = await db.query('SELECT * FROM market_holidays WHERE holiday_date = ?', [todayDate]);
    const isHoliday = holidays.length > 0;

    // ✅ Market is open only if it's not a holiday and within market hours
    const isMarketOpen = market.is_open && now >= marketOpen && now <= marketClose && !isHoliday;

    // ✅ Fetch user holdings
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

    const totalValueNow = holdings.reduce(
      (sum, h) => sum + (h.quantity * h.current_price),
      0
    );

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
      user: fullUser,
      holdings,
      totalValueNow,
      percentChange,
      isMarketOpen // ✅ Send to EJS
    });

  } catch (err) {
    console.error('❌ Dashboard error:', err);
    res.render('dashboard', {
      title: 'Dashboard',
      user: req.session.user,
      holdings: [],
      totalValueNow: 0,
      percentChange: 0,
      error: 'Could not load your portfolio.',
      isMarketOpen: false // Fallback
    });
  }
});

module.exports = router;