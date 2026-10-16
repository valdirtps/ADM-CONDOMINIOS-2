const { execSync } = require('child_process');

// Ensure database URL environment variables are defined so prisma generate does not fail during deployment builds
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres.luwzppwogjnktckkkuhl:Val190103Bd2026@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=3";
process.env.DIRECT_URL = process.env.DIRECT_URL || "postgresql://postgres.luwzppwogjnktckkkuhl:Val190103Bd2026@aws-0-us-east-1.pooler.supabase.com:5432/postgres?connect_timeout=3";

console.log('[Build] Running prisma generate...');
try {
  execSync('npx --no-install prisma generate || npx prisma generate', { stdio: 'inherit', env: process.env });
} catch (err) {
  console.warn('[Build] Prisma generate warning, continuing with existing client:', err.message);
}

console.log('[Build] Running next build...');
execSync('next build', { stdio: 'inherit', env: process.env });
