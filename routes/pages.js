const express = require('express');
const router = express.Router();
const checkAuth = (req, res, next) => req.session.user ? next() : res.redirect('/');

// User routes
router.get('/search', checkAuth, (req, res) => res.render('search', { title: 'Search Stocks' }));
router.get('/ticker/:symbol', checkAuth, (req, res) => res.render('ticker', { title: 'Stock Info', symbol: req.params.symbol }));
router.get('/transactions', checkAuth, (req, res) => res.render('transactions', { title: 'Transaction History' }));
router.get('/cash', checkAuth, (req, res) => res.render('cash', { title: 'Manage Cash' }));

// Admin routes
router.get('/admin', checkAuth, (req, res) => res.render('admin', { title: 'Admin Panel' }));
router.get('/admin/create-stock', checkAuth, (req, res) => res.render('create-stock', { title: 'Create Stock' }));
router.get('/admin/market-hours', checkAuth, (req, res) => res.render('market-hours', { title: 'Market Hours' }));

module.exports = router;