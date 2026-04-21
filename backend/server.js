require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
app.set('trust proxy', 1); // Railway usa proxy

// ── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Sirve el frontend estático desde /frontend/public
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Demasiados intentos, esperá 15 minutos.' } });
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);

// ── RUTAS ────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/inversores',    require('./routes/inversores'));
app.use('/api/propiedades',   require('./routes/propiedades'));
app.use('/api/aportes',       require('./routes/aportes'));
app.use('/api/participaciones', require('./routes/participaciones'));
app.use('/api/liquidaciones', require('./routes/liquidaciones'));
app.use('/api/documentos',    require('./routes/documentos'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/admin',         require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// SPA fallback — todo lo que no sea /api/ vuelve al index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
  } else {
    res.status(404).json({ error: 'Ruta no encontrada' });
  }
});

// ── ERROR HANDLER ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ DIGSA Backend corriendo en puerto ${PORT}`));
