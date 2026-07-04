const express = require('express');
const path = require('path');
const { nanoid } = require('nanoid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

app.post('/api/shorten', (req, res) => {
  const { url, customCode } = req.body || {};

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL. Must start with http:// or https://' });
  }

  let code = customCode && customCode.trim();
  if (code) {
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(code)) {
      return res.status(400).json({ error: 'Custom code must be 3-20 chars (letters, numbers, - or _)' });
    }
    const exists = db.prepare('SELECT 1 FROM links WHERE code = ?').get(code);
    if (exists) {
      return res.status(409).json({ error: 'Custom code already in use' });
    }
  } else {
    do {
      code = nanoid(6);
    } while (db.prepare('SELECT 1 FROM links WHERE code = ?').get(code));
  }

  db.prepare('INSERT INTO links (code, target_url) VALUES (?, ?)').run(code, url);

  res.json({ shortUrl: `${BASE_URL}/${code}`, code });
});

app.get('/api/stats/:code', (req, res) => {
  const row = db.prepare('SELECT code, target_url, created_at, click_count FROM links WHERE code = ?').get(req.params.code);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.get('/:code', (req, res, next) => {
  const { code } = req.params;
  const row = db.prepare('SELECT target_url FROM links WHERE code = ?').get(code);
  if (!row) return next();
  db.prepare('UPDATE links SET click_count = click_count + 1 WHERE code = ?').run(code);
  res.redirect(row.target_url);
});

app.listen(PORT, () => {
  console.log(`URL shortener running at ${BASE_URL}`);
});
