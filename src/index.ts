import http from 'http';
import app from './app.js';

if(!process.env.PORT) throw new Error('PORT environment variable is not set.');

const PORT = parseInt(process.env.PORT, 10);

const server = http.createServer(app);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});
