const express = require('express');
const router = express.Router();
const checkAuth = (req, res, next) => req.session.user ? next() : res.redirect('/');
const db = require('../db');
const checkAdmin = (req, res, next) => {
    if (req.session.user?.role === 'admin') return next();
    return res.status(403).render('403', { title: 'Access Denied' });
};

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

router.get('/ticker/:symbol', checkAuth, (req, res) => {
    const referer = req.get('Referrer') || '/search'; // fallback to /search
    res.render('ticker', {
      title: 'Stock Info',
      symbol: req.params.symbol,
      referer
    });
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

module.exports = router;