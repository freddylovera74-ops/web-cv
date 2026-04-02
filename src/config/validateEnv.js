const REQUIRED_ALWAYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SESSION_SECRET',
  'STRIPE_SECRET_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'WHATSAPP_NUMBER',
  'BASE_URL',
  'OPENROUTER_API_KEY',
];

// Only required in production (webhook needs a public URL to register in Stripe)
const REQUIRED_IN_PRODUCTION = [
  'STRIPE_WEBHOOK_SECRET',
];

function validateEnv() {
  const required = process.env.NODE_ENV === 'production'
    ? [...REQUIRED_ALWAYS, ...REQUIRED_IN_PRODUCTION]
    : REQUIRED_ALWAYS;

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('\n❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nSet these variables in your Railway dashboard (Settings > Variables)');
    console.error('and redeploy.\n');
    process.exit(1);
  }

  console.log('✓ Environment variables validated');
}

module.exports = validateEnv;
