import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { spawn } from 'child_process';

// Mock server for testing
let server;

test.before(async () => {
  // Start the server for testing
  server = spawn('node', ['api/index.js'], {
    env: { ...process.env, NODE_ENV: 'test', PORT: 3001 },
    stdio: 'pipe'
  });
  
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
});

test.after(async () => {
  if (server) {
    server.kill();
  }
});

test('Health endpoint should return 200', async (t) => {
  const response = await fetch('http://localhost:3001/health');
  assert.strictEqual(response.status, 200);
  
  const data = await response.json();
  assert.strictEqual(data.status, 'healthy');
});

test('Metrics endpoint should return Prometheus format', async (t) => {
  const response = await fetch('http://localhost:3001/metrics');
  assert.strictEqual(response.status, 200);
  
  const text = await response.text();
  assert.ok(text.includes('ast_'), 'Should contain custom metrics prefix');
});

test('API should handle invalid routes gracefully', async (t) => {
  const response = await fetch('http://localhost:3001/api/nonexistent');
  assert.strictEqual(response.status, 404);
});

test('Auth nonce endpoint should work', async (t) => {
  const response = await fetch('http://localhost:3001/api/auth/nonce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: '0x1234567890123456789012345678901234567890' })
  });
  
  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.ok(data.nonce, 'Should return a nonce');
});
