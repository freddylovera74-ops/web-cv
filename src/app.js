require('dotenv').config();
require('./config/validateEnv')();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDb, getDb } = require('./db');
const SqliteStore = require('better-sqlite3-session-store')(session);
require('./services/passport');

const app = express();

// OWASP-FIX: A05 — Trust proxy for accurate IP detection behind reverse proxies (nginx, etc.)
app.set('trust proxy', 1);

// OWASP-FIX: A05 — Security headers via Helmet (X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, etc.)
// CSP allows unsafe-inline for scripts/styles because edit.js uses inline <script> blocks
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// OWASP-FIX: A04 — Rate limiting on auth and payment endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.',
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiadas solicitudes de pago. Intenta mas tarde.',
});

app.use('/auth', authLimiter);
app.use('/create-checkout-session', paymentLimiter);

// Raw body needed for Stripe webhook signature verification - must be before express.json()
app.use('/stripe-webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OWASP-FIX: A07 — Harden session cookie + persist sessions in SQLite (survives deploys)
app.use(session({
  store: new SqliteStore({
    client: getDb(),
    expired: { clear: true, intervalMs: 15 * 60 * 1000 },
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', require('./routes/auth'));
app.use('/webhook', require('./routes/whatsapp'));
app.use('/crear', require('./routes/wizard'));
app.use('/', require('./routes/cv'));
app.use('/', require('./routes/payment'));
app.use('/editar', require('./routes/edit'));
app.use('/cv-ejemplo', require('./routes/ejemplos'));

// OWASP-FIX: A05 — Global error handler: never expose stack traces or internal details
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path} —`, err.message);
  res.status(500).send('Error interno del servidor');
});

initDb();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
