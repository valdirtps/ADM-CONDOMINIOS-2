const { execSync } = require('child_process');
try {
  const result = execSync('npx typescript@latest tsc --noEmit', { encoding: 'utf8', stdio: 'pipe' });
  console.log('Success:', result);
} catch (e) {
  console.error('Error:', e.stdout);
}
