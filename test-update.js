const http = require('http');

async function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  try {
    // 1. Login
    console.log('Logging in as admin@sistema.com...');
    const loginBody = JSON.stringify({ email: 'admin@sistema.com', password: 'admin123' });
    const loginRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginBody.length
      }
    }, loginBody);

    console.log('Login Status:', loginRes.status);
    const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';
    console.log('Cookie found:', !!cookie);

    // 2. Update Despesa
    const despesaId = 'cmoyxykcu0003jy048uy2cdbl';
    console.log(`Updating despesa ${despesaId}...`);
    const updateBody = JSON.stringify({
      tipo: 'Material Limpeza',
      valor: 356.36,
      referente: '2026-04',
      observacao: 'PRODUTOS DE LIMPEZA UPDATED',
      data_pagamento: '2026-04-24'
    });

    const updateRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/despesas/${despesaId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': updateBody.length,
        'Cookie': cookie
      }
    }, updateBody);

    console.log('Update Status:', updateRes.status);
    console.log('Update Content-Type:', updateRes.headers['content-type']);
    console.log('Update Body:', updateRes.body.substring(0, 500));

  } catch (err) {
    console.error('Test failed:', err);
  }
}

main();
