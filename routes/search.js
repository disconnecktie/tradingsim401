const db = require('../db');

router.get('/search', checkAuth, async (req, res) => {
  const query = req.query.q?.toUpperCase() || '';
  let results = [];
  let error = null;

  console.log('🧭 /search route hit with query:', query);

  try {
    if (query) {
      console.log('🔍 Searching for stocks with query:', query);
      [results] = await db.query(
        'SELECT * FROM stocks WHERE ticker_symbol LIKE ?', [`%${query}%`]
      );
    } else {
      console.log('📋 No query provided, returning all stocks');
      [results] = await db.query(
        'SELECT * FROM stocks ORDER BY ticker_symbol ASC'
      );
    }
  } catch (err) {
    console.error('❌ DB error:', err.message);
    error = 'Error fetching stocks.';
  }

  console.log('✅ Rendering search page with:', { query, resultsLength: results.length, error });

  res.render('search', {
    title: 'Search Stocks',
    query,
    results,
    error
  });
});