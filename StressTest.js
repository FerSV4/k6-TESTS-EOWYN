import http from 'k6/http';
import { check } from 'k6';

// Stress con etapas: sube usuarios progresivamente hasta superar el SLO/SLA
export let options = {
  stages: [
    { duration: '1m', target: 30 },    // Calentamiento
    { duration: '1m', target: 60 },    // Subida
    { duration: '1m', target: 100 },   // SLA
    { duration: '1m', target: 150 },   // SLO
    { duration: '1m', target: 200 },   // Supera SLO
    { duration: '1m', target: 0 },     // Ramp-down
  ],
  thresholds: {
    'http_req_failed': ['rate<0.10'],  // Acepta hasta un 10% en stress (para ver el fallo, no para cumplir SLO/SLA)
    'http_req_duration': ['p(95)<1500'], // Puedes aumentar el límite en stress (>SLO/SLA)
  },
};

const userIds = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40]; 

export function setup() {
  let loginRes = http.post('http://localhost:3001/api/auth/login', { email: 'admin@example.com', password: '123456' });
  check(loginRes, { 'login status 200': (r) => r.status === 200 });
  return { token: loginRes.json('token') };
}

export default function (data) {
  let headers = { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' };

  const vuIndex = (__VU - 1) % userIds.length;
  const userId = userIds[vuIndex];

  // Crear libro
  const isbn = '978' + Math.floor(Math.random() * 10000000) + Date.now();
  let bookPayload = {
    title: 'StressBook',
    author: 'K6 Stress',
    isbn: isbn,
    publicationYear: '2025',
    categoryId: 1,
    totalQuantity: 2,
    availableQuantity: 2,
  };
  let bookRes = http.post('http://localhost:3001/api/books', JSON.stringify(bookPayload), { headers });
  if (!check(bookRes, { 'POST libro status 201': (r) => r.status === 201 })) {
    console.log('Error al crear libro:', bookRes.status, bookRes.body);
    return;
  }
  const bookId = bookRes.json('id');

  // Fecha para préstamo
  const fechaFutura = (dias) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + dias);
    return dt.toISOString().split('T')[0];
  };
  const dueDate = fechaFutura(7);

  // Crear préstamo
  let loanPayload = {
    bookId: bookId,
    userId: userId,
    dueDate: dueDate,
  };
  let loanRes = http.post('http://localhost:3001/api/loans', JSON.stringify(loanPayload), { headers });
  if (!check(loanRes, { 'POST préstamo status 201': (r) => r.status === 201 })) {
    console.log('Error POST préstamo:', loanRes.status, loanRes.body);
    return;
  }
  const loanId = loanRes.json('id');

  // Devolver préstamo
  let returnPayload = { userId: userId, bookId: bookId };
  let returnRes = http.put(`http://localhost:3001/api/loans/${loanId}/return`, JSON.stringify(returnPayload), { headers });
  if (!check(returnRes, { 'PUT devolución status 200': (r) => r.status === 200 })) {
    console.log('Error PUT devolución:', returnRes.status, returnRes.body);
  }
}
