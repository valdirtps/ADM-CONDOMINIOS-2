const dbUrl = process.env.DIRECT_URL || '';
console.log('DIRECT URL length:', dbUrl.length);
console.log('DIRECT URL starts with:', dbUrl.substring(0, 30));
console.log('DIRECT URL contains password:', dbUrl.includes('Val190103Bd2026'));
console.log('Chars:', dbUrl.split('').map(c => c.charCodeAt(0)).join(', '));
