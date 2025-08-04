import http from 'node:http';
const server = http.createServer((req, res) => {
  res.end('Node server žije!');
});
server.listen(8888, () => console.log('Node server běží na portu 8888'));
