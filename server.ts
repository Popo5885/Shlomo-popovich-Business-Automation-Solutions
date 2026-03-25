import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initSocketIO } from './src/lib/socket';
import { SessionManager } from './src/server/whatsapp/SessionManager';
import { QueueManager } from './src/server/queue/QueueManager';
import { Watchdog } from './src/server/whatsapp/Watchdog';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const hostname = '0.0.0.0';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Initialize Socket.IO
  initSocketIO(httpServer);
  console.log('✅ Socket.IO initialized');

  // Initialize BullMQ workers
  const queueManager = QueueManager.getInstance();
  await queueManager.startAllWorkers();
  console.log('✅ BullMQ workers started');

  // Initialize WhatsApp sessions
  const sessionManager = SessionManager.getInstance();
  await sessionManager.restoreAllSessions();
  console.log('✅ WhatsApp sessions restored');

  // Start self-healing watchdog
  Watchdog.start();
  console.log('✅ Watchdog started');

  httpServer.listen(port, hostname, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
    console.log(`🌐 Mode: ${dev ? 'development' : 'production'}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n⚠️  ${signal} received — shutting down...`);
    Watchdog.stop();
    await sessionManager.disconnectAll();
    await queueManager.closeAll();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
