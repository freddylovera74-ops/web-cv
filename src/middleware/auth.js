function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/auth/google');
}

function requireOwner(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect('/auth/google');
  const { getDb } = require('../db');
  const db = getDb();
  const userId = parseInt(req.params.userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || user.email !== req.user.email) {
    return res.status(403).send('Forbidden');
  }
  req.targetUser = user;
  next();
}

module.exports = { requireAuth, requireOwner };
