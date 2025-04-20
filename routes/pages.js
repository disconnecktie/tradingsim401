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

router.get('/ticker/:symbol', checkAuth, (req, res) => res.render('ticker', { title: 'Stock Info', symbol: req.params.symbol }));
router.get('/transactions', checkAuth, (req, res) => res.render('transactions', { title: 'Transaction History' }));
router.get('/cash', checkAuth, (req, res) => res.render('cash', { title: 'Manage Cash' }));

// Admin routes
router.get('/admin', checkAuth, checkAdmin, (req, res) =>
    res.render('admin/panel', { title: 'Admin Panel' })
);
  
router.get('/admin/create-stock', checkAuth, checkAdmin, (req, res) =>
    res.render('admin/create-stock', { title: 'Create Stock' })
);
  
router.get('/admin/market-hours', checkAuth, checkAdmin, (req, res) =>
    res.render('admin/market-hours', { title: 'Market Hours' })
);

module.exports = router;