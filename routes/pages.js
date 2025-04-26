const express = require('express');
const router = express.Router();
const checkAuth = (req, res, next) => req.session.user ? next() : res.redirect('/');
const db = require('../db');
const checkAdmin = (req, res, next) => {
  if (req.session.user?.role === 'admin' || req.session.user?.role === 'superadmin') return next();
  return res.status(403).render('403', { title: 'Access Denied' });
};

const { DateTime } = require('luxon'); // if not already at top

async function isMarketOpen() {
  const [marketRows] = await db.query('SELECT * FROM market_hours LIMIT 1');
  const market = marketRows[0];

  const [[settings]] = await db.query('SELECT force_market_open FROM system_settings LIMIT 1');
  const forceMarketOpen = settings?.force_market_open || false;

  if (forceMarketOpen) return true; // 🚀 Forced open, override everything

  if (!market.is_open) return false;

  const tz = market.timezone || 'America/New_York';
  const now = DateTime.now().setZone(tz);

  const open = DateTime.fromFormat(market.open_time, 'HH:mm:ss', { zone: tz });
  const close = DateTime.fromFormat(market.close_time, 'HH:mm:ss', { zone: tz });

  const dayOfWeek = now.weekday; // Monday = 1, Sunday = 7
  if (dayOfWeek === 6 || dayOfWeek === 7) {
    return false;
  }

  const todayDate = now.toISODate(); // 'YYYY-MM-DD'
  const [holidays] = await db.query('SELECT * FROM market_holidays WHERE holiday_date = ?', [todayDate]);
  const isHoliday = holidays.length > 0;

  return now >= open && now <= close && !isHoliday;
}

// User routes
router.get('/search', checkAuth, async (req, res) => {
    const query = req.query.q?.toUpperCase() || '';
    try {
      const [results] = query
        ? await db.query('SELECT * FROM stocks WHERE ticker_symbol LIKE ?', [`%${query}%`])
        : await db.query('SELECT * FROM stocks ORDER BY ticker_symbol ASC');
  
      res.render('search', {
        title: 'Search Stocks',
        query,
        results
      });
    } catch (err) {
      console.error(err);
      res.render('search', { title: 'Search Stocks', error: 'Error fetching stocks.', results: [] });
    }
});

router.get('/ticker/:symbol', checkAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const userId = req.session.user.id;
  const referer = req.get('Referrer') || '/search';

  try {
    const [holdingRows] = await db.query(
      'SELECT quantity FROM user_holdings WHERE user_id = ? AND ticker_symbol = ?',
      [userId, symbol]
    );

    const ownedQuantity = holdingRows.length > 0 ? holdingRows[0].quantity : 0;

    const marketOpen = await isMarketOpen(); // 🆕 Add this line

    res.render('ticker', {
      title: 'Stock Info',
      symbol,
      referer,
      ownedQuantity,
      marketOpen // 🆕 Pass to EJS
    });
  } catch (err) {
    console.error('❌ Error loading stock page:', err);
    res.redirect('/dashboard');
  }
});

router.get('/transactions', checkAuth, async (req, res) => {
    try {
      const [transactions] = await db.query(
        `SELECT * FROM user_transactions WHERE user_id = ? ORDER BY transaction_time DESC`,
        [req.session.user.id]
      );
      res.render('transactions', {
        title: 'Transaction History',
        transactions
      });
    } catch (err) {
      console.error('❌ Error fetching transactions:', err);
      res.render('transactions', {
        title: 'Transaction History',
        transactions: [],
        error: 'Could not load your transaction history.'
      });
    }
});
  
router.get('/cash', checkAuth, async (req, res) => {
    const [userRows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    const user = userRows[0];
    user.cashBalance = parseFloat(user.cashBalance);
  
    res.render('cash', {
      title: 'Manage Funds',
      user
    });
});  

// Admin routes
router.get('/admin', checkAuth, checkAdmin, (req, res) =>
    res.render('admin/panel', { title: 'Admin Panel' })
);
  
router.get('/admin/create-stock', checkAuth, checkAdmin, (req, res) =>
    res.render('admin/create-stock', { title: 'Create Stock' })
);
  
router.get('/admin/market-hours', checkAuth, checkAdmin, async (req, res) => {
    try {
      const [rows] = await db.query('SELECT * FROM market_hours LIMIT 1');
      const hours = rows[0];
      res.render('admin/market-hours', {
        title: 'Market Hours',
        hours
      });
    } catch (err) {
      console.error('❌ Failed to load market hours:', err);
      res.render('admin/market-hours', {
        title: 'Market Hours',
        error: 'Could not load trading schedule.',
        hours: null
      });
    }
});

router.get('/admin/holidays', checkAuth, checkAdmin, async (req, res) => {
    const [holidays] = await db.query('SELECT * FROM market_holidays ORDER BY holiday_date');
    res.render('admin/holidays', { title: 'Market Holidays', holidays });
});
  
router.get('/admin/activity-log', checkAuth, checkAdmin, (req, res) =>
    res.render('admin/activity-log', { title: 'Admin Activity Log' })
);
  
// only available to root admin
const checkRootAdmin = (req, res, next) => {
if (req.session.user?.role === 'superadmin') return next();
    return res.status(403).render('403', { title: 'Access Denied' });
};
  
router.get('/admin/control-center', checkAuth, checkRootAdmin, (req, res) =>
    res.render('admin/control-center', { title: 'System Control Center' })
);

router.get('/admin/manage-users', checkAuth, checkRootAdmin, async (req, res) => {
    try {
      const [users] = await db.query('SELECT id, fullname, email, role, is_active FROM users ORDER BY id');
      const flash = req.session.flash;
      delete req.session.flash;
      res.render('admin/manage-users', {
        title: 'Manage Users',
        users,
        user: req.session.user,
        flash
      });
    } catch (err) {
      console.error('❌ Error loading users:', err);
      res.status(500).render('admin/manage-users', {
        title: 'Manage Users',
        users: [],
        error: 'Failed to load user list.'
      });
    }
});

// Promote user to admin
router.post('/admin/promote/:id', checkAuth, checkRootAdmin, async (req, res) => {
    const targetId = parseInt(req.params.id);
    try {
      await db.query('UPDATE users SET role = ? WHERE id = ?', ['admin', targetId]);
      req.session.flash = 'User promoted to admin.';
    } catch (err) {
      console.error('❌ Promote error:', err);
      req.session.flash = 'Failed to promote user.';
    }
    res.redirect('/admin/manage-users');
});
  
// Demote admin to user
router.post('/admin/demote/:id', checkAuth, checkRootAdmin, async (req, res) => {
    const targetId = parseInt(req.params.id);
    try {
      // 🛡️ Check if target is a superadmin
      const [rows] = await db.query('SELECT role FROM users WHERE id = ?', [targetId]);
      const targetRole = rows[0]?.role;
  
      if (targetRole === 'superadmin') {
        // Count how many superadmins exist
        const [superadmins] = await db.query(`SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'`);
        if (superadmins[0].count <= 1) {
          req.session.flash = 'Cannot demote the last superadmin.';
          return res.redirect('/admin/manage-users');
        }
      }
  
      await db.query('UPDATE users SET role = ? WHERE id = ?', ['user', targetId]);
      req.session.flash = 'User demoted successfully.';
    } catch (err) {
      console.error('❌ Demote error:', err);
      req.session.flash = 'Failed to demote user.';
    }
    res.redirect('/admin/manage-users');
});

// POST /admin/deactivate/:id
router.post('/admin/deactivate/:id', async (req, res) => {
  const userId = req.params.id;
  await db.query('UPDATE users SET is_active = FALSE WHERE id = ?', [userId]);
  req.session.flash = 'User successfully deactivated.';
  res.redirect('/admin/manage-users');
});

// POST /admin/reactivate/:id
router.post('/admin/reactivate/:id', async (req, res) => {
  const userId = req.params.id;
  await db.query('UPDATE users SET is_active = TRUE WHERE id = ?', [userId]);
  req.session.flash = 'User successfully reactivated.';
  res.redirect('/admin/manage-users');
});

// Save Market Hours Updates
router.post('/admin/market-hours', checkAuth, checkAdmin, async (req, res) => {
    const { open_time, close_time } = req.body;
  
    try {
      await db.query('UPDATE market_hours SET open_time = ?, close_time = ? WHERE id = 1', [
        open_time,
        close_time
      ]);
      req.session.flash = 'Market hours updated successfully.';
    } catch (err) {
      console.error('❌ Failed to update market hours:', err);
      req.session.flash = 'Failed to update market hours.';
    }
  
    res.redirect('/admin/market-hours');
});
  
router.post('/admin/holidays', checkAuth, checkAdmin, async (req, res) => {
    const { name, holiday_date } = req.body;
  
    try {
      await db.query('INSERT INTO market_holidays (holiday_date, name) VALUES (?, ?)', [
        holiday_date,
        name
      ]);
      req.session.flash = 'Holiday added.';
    } catch (err) {
      console.error('❌ Error adding holiday:', err);
      req.session.flash = 'Failed to add holiday.';
    }
  
    res.redirect('/admin/holidays');
});

router.post('/admin/holidays/delete/:id', checkAuth, checkAdmin, async (req, res) => {
    const id = req.params.id;
    try {
      await db.query('DELETE FROM market_holidays WHERE id = ?', [id]);
      req.session.flash = 'Holiday removed.';
    } catch (err) {
      console.error('❌ Error deleting holiday:', err);
      req.session.flash = 'Failed to delete holiday.';
    }
    res.redirect('/admin/holidays');
});

// POST /buy/:symbol
router.post('/buy/:symbol', checkAuth, async (req, res) => {
  const userId = req.session.user.id;
  const tickerSymbol = req.params.symbol.toUpperCase();
  const quantity = parseInt(req.body.quantity, 10);

  if (!quantity || quantity <= 0) {
    req.session.flash = 'Invalid quantity.';
    return res.redirect('/dashboard');
  }

  if (!(await isMarketOpen())) {
    req.session.flash = 'Market is currently closed. Cannot buy stocks.';
    return res.redirect('/dashboard');
  }

  try {
    // Get current stock price
    const [stockRows] = await db.query('SELECT current_price FROM stocks WHERE ticker_symbol = ?', [tickerSymbol]);
    if (stockRows.length === 0) {
      req.session.flash = 'Stock not found.';
      return res.redirect('/dashboard');
    }
    const stockPrice = parseFloat(stockRows[0].current_price);

    const totalCost = quantity * stockPrice;

    // Get user's current cash balance
    const [userRows] = await db.query('SELECT cashBalance FROM users WHERE id = ?', [userId]);
    const cashBalance = parseFloat(userRows[0].cashBalance);

    if (cashBalance < totalCost) {
      req.session.flash = 'Insufficient funds.';
      return res.redirect('/dashboard');
    }

    // Deduct cash
    await db.query('UPDATE users SET cashBalance = cashBalance - ? WHERE id = ?', [totalCost, userId]);

    // Add to holdings (insert or update)
    const [holdingRows] = await db.query(
      'SELECT quantity FROM user_holdings WHERE user_id = ? AND ticker_symbol = ?',
      [userId, tickerSymbol]
    );

    if (holdingRows.length > 0) {
      // Update existing holding
      await db.query(
        'UPDATE user_holdings SET quantity = quantity + ? WHERE user_id = ? AND ticker_symbol = ?',
        [quantity, userId, tickerSymbol]
      );
    } else {
      // Insert new holding
      await db.query(
        'INSERT INTO user_holdings (user_id, ticker_symbol, quantity) VALUES (?, ?, ?)',
        [userId, tickerSymbol, quantity]
      );
    }

    // Record transaction
    await db.query(
      `INSERT INTO user_transactions (user_id, ticker_symbol, quantity, price_at_transaction, transaction_type, transaction_time)
       VALUES (?, ?, ?, ?, 'buy', NOW())`,
      [userId, tickerSymbol, quantity, stockPrice]
    );

    req.session.flash = `Successfully purchased ${quantity} shares of ${tickerSymbol}.`;
    res.redirect('/dashboard');

  } catch (err) {
    console.error('❌ Error processing purchase:', err);
    req.session.flash = 'Purchase failed.';
    res.redirect('/dashboard');
  }
});

// POST /sell/:symbol
router.post('/sell/:symbol', checkAuth, async (req, res) => {
  const userId = req.session.user.id;
  const tickerSymbol = req.params.symbol.toUpperCase();
  const quantity = parseInt(req.body.quantity, 10);

  if (!quantity || quantity <= 0) {
    req.session.flash = 'Invalid quantity.';
    return res.redirect('/dashboard');
  }

  if (!(await isMarketOpen())) {
    req.session.flash = 'Market is currently closed. Cannot sell stocks.';
    return res.redirect('/dashboard');
  }  

  try {
    // Get current stock price
    const [stockRows] = await db.query('SELECT current_price FROM stocks WHERE ticker_symbol = ?', [tickerSymbol]);
    if (stockRows.length === 0) {
      req.session.flash = 'Stock not found.';
      return res.redirect('/dashboard');
    }
    const stockPrice = parseFloat(stockRows[0].current_price);

    const totalProceeds = quantity * stockPrice;

    // Get user's current holding
    const [holdingRows] = await db.query(
      'SELECT quantity FROM user_holdings WHERE user_id = ? AND ticker_symbol = ?',
      [userId, tickerSymbol]
    );

    if (holdingRows.length === 0 || holdingRows[0].quantity < quantity) {
      req.session.flash = 'Not enough shares to sell.';
      return res.redirect('/dashboard');
    }

    // Subtract from holdings
    await db.query(
      'UPDATE user_holdings SET quantity = quantity - ? WHERE user_id = ? AND ticker_symbol = ?',
      [quantity, userId, tickerSymbol]
    );

    // Add cash to user
    await db.query('UPDATE users SET cashBalance = cashBalance + ? WHERE id = ?', [totalProceeds, userId]);

    // Record transaction
    await db.query(
      `INSERT INTO user_transactions (user_id, ticker_symbol, quantity, price_at_transaction, transaction_type, transaction_time)
       VALUES (?, ?, ?, ?, 'sell', NOW())`,
      [userId, tickerSymbol, quantity, stockPrice]
    );

    // Optional: delete holding if quantity becomes zero
    await db.query(
      'DELETE FROM user_holdings WHERE user_id = ? AND ticker_symbol = ? AND quantity <= 0',
      [userId, tickerSymbol]
    );

    req.session.flash = `Successfully sold ${quantity} shares of ${tickerSymbol}.`;
    res.redirect('/dashboard');

  } catch (err) {
    console.error('❌ Error processing sale:', err);
    req.session.flash = 'Sale failed.';
    res.redirect('/dashboard');
  }
});

// POST /admin/create-stock
router.post('/admin/create-stock', checkAuth, checkAdmin, async (req, res) => {
  const { company_name, ticker_symbol, volume, initial_price } = req.body;

  try {
    await db.query(
      'INSERT INTO stocks (company_name, ticker_symbol, volume, current_price) VALUES (?, ?, ?, ?)',
      [company_name, ticker_symbol.toUpperCase(), volume, initial_price]
    );
    req.session.flash = 'Stock created successfully.';
    res.redirect('/admin/create-stock');
  } catch (err) {
    console.error('❌ Error creating stock:', err);
    req.session.flash = 'Failed to create stock.';
    res.redirect('/admin/create-stock');
  }
});

router.post('/toggle-market', async (req, res) => {
  if (!req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'superadmin')) {
    return res.status(403).send('Forbidden');
  }

  const { forceOpen } = req.body;
  await db.query('UPDATE system_settings SET force_market_open = ?', [forceOpen === "1" ? 1 : 0]);
  res.redirect('/admin/control-center');
});

module.exports = router;