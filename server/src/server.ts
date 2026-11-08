import app from './app';
import { env } from './config/env';

const PORT = Number(process.env.PORT) || env.PORT || 5000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`[ForgeQuote API] Server is running on http://${HOST}:${PORT}`);
  console.log(`[ForgeQuote API] Environment: ${env.NODE_ENV}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

