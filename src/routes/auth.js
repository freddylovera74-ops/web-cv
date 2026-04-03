const router = require('express').Router();
const passport = require('passport');

// Store a safe returnTo path before redirecting to Google
router.get('/google', (req, res, next) => {
  if (req.query.returnTo) {
    // Validate: only allow relative paths (prevent open redirect)
    const returnTo = req.query.returnTo;
    if (/^\/[a-zA-Z0-9/?=&._-]*$/.test(returnTo)) {
      req.session.returnTo = returnTo;
    }
  }
  passport.authenticate('google', { scope: ['email', 'profile'] })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    const returnTo = req.session.returnTo || `/cv/${req.user.id}`;
    delete req.session.returnTo;
    res.redirect(returnTo);
  }
);

router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/');
  });
});

module.exports = router;
