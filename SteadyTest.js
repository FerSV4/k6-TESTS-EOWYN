import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,                // Usuarios virtuales constantes (ajusta según tu capacidad)
  duration: '5m',        // Duración de la prueba steady state (puedes ajustar a 30m si tu entorno lo soporta)
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration': ['p(95)<400'],
  },
};

// Ids de usuarios
const userIds = [5, 7, 8, 9, 10, 11, 12, 13, 14, 15];

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
    title: 'SteadyStateBook',
    author: 'K6 Steady',
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
