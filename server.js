// server.js

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const app = express();
const PORT = 3000;

// Use express-ejs-layouts
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');

// Serve static files from /public
app.use(express.static('public'));

// Routes
app.get(`/`, (req, res) => {
	res.render(`index`, { title: `Home`, appName: `StockTrader`});
});

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
