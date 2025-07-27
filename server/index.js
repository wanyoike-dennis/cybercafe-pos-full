const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// SQLite DB setup
const dbPath = path.resolve(__dirname, 'pos.db');
const db = new Database(dbPath);

// Create tables if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    computer TEXT,
    duration INTEGER,
    charge INTEGER,
    timestamp TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    timestamp TEXT
  );
`);

app.get('/', (req, res) => {
  res.send('Cyber Café POS API with SQLite (better-sqlite3) is running.');
});

// Save session and products
app.post('/save-sale', (req, res) => {
  const { items = [], sessions = [] } = req.body;
  const timestamp = new Date().toISOString();

  const insertSession = db.prepare(`INSERT INTO sessions (computer, duration, charge, timestamp) VALUES (?, ?, ?, ?)`);
  const insertProduct = db.prepare(`INSERT INTO products (name, price, timestamp) VALUES (?, ?, ?)`);

  const transaction = db.transaction(() => {
    sessions.forEach(s => {
      insertSession.run(s.computer, s.duration, s.charge, timestamp);
    });

    items.forEach(i => {
      insertProduct.run(i.name, i.price, timestamp);
    });
  });

  try {
    transaction();
    res.send({ message: 'Sale recorded successfully.' });
  } catch (err) {
    console.error('Transaction error:', err.message);
    res.status(500).send({ error: 'Failed to record sale.' });
  }
});

// Generate PDF receipt
app.post('/generate-receipt', (req, res) => {
  const { items = [], sessions = [], total = 0 } = req.body;

  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=receipt.pdf');
  doc.pipe(res);

  doc.fontSize(16).text('Cyber Café Receipt', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text('Sessions:', { underline: true });
  sessions.forEach(s => {
    doc.text(`Computer: ${s.computer} | Duration: ${s.duration} min | Charge: KES ${s.charge}`);
  });
  doc.moveDown();

  doc.fontSize(12).text('Products/Services:', { underline: true });
  items.forEach(i => {
    doc.text(`${i.name} - KES ${i.price}`);
  });
  doc.moveDown();

  doc.fontSize(14).text(`Total: KES ${total}`);
  doc.end();
});

// Optional: Serve public assets
app.use('/public', express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
