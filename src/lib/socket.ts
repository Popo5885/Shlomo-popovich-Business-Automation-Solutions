import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    path: process.env.SOCKET_IO_PATH || '/socket.io',
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    const clientId = socket.handshake.query.clientId as string;
    if (clientId) {
      socket.join(`client:${clientId}`);
    }

    socket.on('subscribe:number', (numberId: string) => {
      socket.join(`number:${numberId}`);
    });

    socket.on('disconnect', () => {
      // cleanup handled by Socket.IO automatically
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

// Emit helpers
export function emitQR(clientId: string, numberId: string, qrBase64: string) {
  getIO().to(`client:${clientId}`).emit('qr', { numberId, qr: qrBase64 });
}

export function emitNumberStatus(
  clientId: string,
  numberId: string,
  status: 'ONLINE' | 'OFFLINE' | 'PAUSED' | 'BANNED',
  phoneNumber?: string,
) {
  getIO()
    .to(`client:${clientId}`)
    .emit('number:status', { numberId, status, phoneNumber });
}

export function emitCampaignProgress(
  clientId: string,
  campaignId: string,
  sent: number,
  total: number,
  failed: number,
) {
  getIO()
    .to(`client:${clientId}`)
    .emit('campaign:progress', { campaignId, sent, total, failed });
}

export function emitDisconnect(clientId: string, numberId: string, phoneNumber: string) {
  getIO()
    .to(`client:${clientId}`)
    .emit('number:disconnect', { numberId, phoneNumber });
}
