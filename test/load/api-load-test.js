import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10, // 10 virtual users
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'], // error rate under 10%
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  // Test health endpoint
  let response = http.get(`${BASE_URL}/health`);
  check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check has correct format': (r) => r.json('status') === 'healthy',
  });

  // Test metrics endpoint
  response = http.get(`${BASE_URL}/metrics`);
  check(response, {
    'metrics status is 200': (r) => r.status === 200,
    'metrics contains prometheus format': (r) => r.body.includes('ast_'),
  });

  // Test marketplace listings
  response = http.get(`${BASE_URL}/api/marketplace/listings`);
  check(response, {
    'listings status is 200': (r) => r.status === 200,
    'listings returns json': (r) => r.json('listings') !== undefined,
  });

  // Test aggregate endpoint
  response = http.get(`${BASE_URL}/api/marketplace/aggregate?platforms=internal&limit=5`);
  check(response, {
    'aggregate status is 200': (r) => r.status === 200,
    'aggregate returns listings': (r) => r.json('listings') !== undefined,
  });

  sleep(1);
}
