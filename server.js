// server.js

const express = require('express');
const app = express();
const PORT = 3000;

app.set(`view engine`, `ejs`);
app.get(`/`, (req, res) => {
	res.render(`index`, { title: `Home`, appName: `StockTrader`});
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
