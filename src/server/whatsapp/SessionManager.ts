import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  WAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as fs from 'fs';
import pino from 'pino';
import { prisma } from '@/lib/prisma';
import { emitQR, emitNumberStatus, emitDisconnect } from '@/lib/socket';
import { MessageHandler } from './MessageHandler';
import { QueueManager } from '../queue/QueueManager';
import QRCode from 'qrcode';

const logger = pino({ level: 'silent' });

interface SessionEntry {
  sock: WASocket;
  clientId: string;
  numberId: string;
  phoneNumber: string;
}

export class SessionManager {
  private static instance: SessionManager;
  private sessions = new Map<string, SessionEntry>();
  private sessionsPath: string;

  private constructor() {
    this.sessionsPath = process.env.SESSIONS_PATH || path.join(process.cwd(), 'sessions');
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true });
    }
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  private getSessionKey(clientId: string, numberId: string) {
    return `${clientId}:${numberId}`;
  }

  private getSessionPath(clientId: string, numberId: string) {
    const dir = path.join(this.sessionsPath, clientId, numberId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async startSession(clientId: string, numberId: string, phoneNumber: string): Promise<void> {
    const key = this.getSessionKey(clientId, numberId);

    // Avoid duplicate sessions
    if (this.sessions.has(key)) {
      await this.disconnectSession(clientId, numberId);
    }

    const sessionPath = this.getSessionPath(clientId, numberId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      browser: ['שלמה פופוביץ', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    this.sessions.set(key, { sock, clientId, numberId, phoneNumber });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Connection state handler
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrBase64 = await QRCode.toDataURL(qr);
          emitQR(clientId, numberId, qrBase64);
        } catch (e) {
          console.error('QR generation error:', e);
        }
      }

      if (connection === 'open') {
        console.log(`✅ WhatsApp connected: ${phoneNumber} (${numberId})`);
        await prisma.connectedNumber.update({
          where: { id: numberId },
          data: { status: 'ONLINE' },
        });
        emitNumberStatus(clientId, numberId, 'ONLINE', phoneNumber);

        // Resume any paused queue for this number
        const qm = QueueManager.getInstance();
        await qm.resumeQueue(numberId);

        // Auto-sync groups to DB (fire-and-forget, don't block connection)
        setTimeout(() => this.syncGroupsToDB(clientId, sock), 3000);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`❌ WhatsApp disconnected: ${phoneNumber}, code=${statusCode}`);

        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          // Banned or logged out
          await prisma.connectedNumber.update({
            where: { id: numberId },
            data: { status: 'BANNED' },
          });
          emitNumberStatus(clientId, numberId, 'BANNED', phoneNumber);
          emitDisconnect(clientId, numberId, phoneNumber);
          // Pause queue
          const qm = QueueManager.getInstance();
          await qm.pauseQueue(numberId);
          this.sessions.delete(key);
        } else if (shouldReconnect) {
          await prisma.connectedNumber.update({
            where: { id: numberId },
            data: { status: 'OFFLINE' },
          });
          emitNumberStatus(clientId, numberId, 'OFFLINE', phoneNumber);
          // Auto-reconnect after 5s
          setTimeout(() => this.startSession(clientId, numberId, phoneNumber), 5000);
        } else {
          await prisma.connectedNumber.update({
            where: { id: numberId },
            data: { status: 'OFFLINE' },
          });
          emitNumberStatus(clientId, numberId, 'OFFLINE', phoneNumber);
          this.sessions.delete(key);
        }
      }
    });

    // Message handler
    const handler = new MessageHandler(clientId, numberId, sock);
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        await handler.handle(msg);
      }
    });

    // Delete sync
    sock.ev.on('messages.delete', async (item) => {
      if ('keys' in item) {
        for (const key of item.keys) {
          await handler.handleDelete(key);
        }
      }
    });
  }

  async disconnectSession(clientId: string, numberId: string): Promise<void> {
    const key = this.getSessionKey(clientId, numberId);
    const entry = this.sessions.get(key);
    if (entry) {
      try {
        await entry.sock.logout();
      } catch {
        // ignore logout errors
      }
      entry.sock.end(undefined);
      this.sessions.delete(key);
    }

    // Clean up session files
    const sessionPath = this.getSessionPath(clientId, numberId);
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  getSocket(clientId: string, numberId: string): WASocket | undefined {
    return this.sessions.get(this.getSessionKey(clientId, numberId))?.sock;
  }

  private async syncGroupsToDB(clientId: string, sock: WASocket): Promise<void> {
    try {
      const groups = await sock.groupFetchAllParticipating();
      const entries = Object.values(groups);
      if (entries.length === 0) return;

      await Promise.all(
        entries.map((g) =>
          prisma.group.upsert({
            where: { clientId_jid: { clientId, jid: g.id } },
            update: { name: g.subject || g.id },
            create: { clientId, jid: g.id, name: g.subject || g.id },
          }),
        ),
      );
      console.log(`📋 Auto-synced ${entries.length} groups for client ${clientId}`);
    } catch (err) {
      console.error(`syncGroupsToDB error for client ${clientId}:`, err);
    }
  }

  async fetchGroups(clientId: string): Promise<Array<{ id: string; subject: string }>> {
    // Get first online session for this client
    for (const [, entry] of this.sessions) {
      if (entry.clientId === clientId) {
        try {
          const groups = await entry.sock.groupFetchAllParticipating();
          return Object.values(groups).map((g) => ({ id: g.id, subject: g.subject }));
        } catch (e) {
          console.error('fetchGroups error:', e);
          return [];
        }
      }
    }
    return [];
  }

  async restoreAllSessions(): Promise<void> {
    const numbers = await prisma.connectedNumber.findMany({
      where: { status: { in: ['ONLINE', 'OFFLINE'] } },
      include: { client: { select: { isActive: true } } },
    });

    for (const number of numbers) {
      if (!number.client.isActive) continue;
      const sessionPath = this.getSessionPath(number.clientId, number.id);
      // Only restore if auth state exists
      if (fs.existsSync(path.join(sessionPath, 'creds.json'))) {
        console.log(`♻️  Restoring session: ${number.phoneNumber}`);
        await this.startSession(number.clientId, number.id, number.phoneNumber);
        // Small delay between restores to avoid rate limiting
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [key, entry] of this.sessions) {
      try {
        entry.sock.end(undefined);
      } catch {
        // ignore
      }
    }
    this.sessions.clear();
  }

  getOnlineNumbersForClient(clientId: string): string[] {
    const numberIds: string[] = [];
    for (const [, entry] of this.sessions) {
      if (entry.clientId === clientId) numberIds.push(entry.numberId);
    }
    return numberIds;
  }

  /**
   * Request a pairing code from Baileys for phone-number-based linking.
   * The number must already have a session started (startSession called first).
   */
  async requestPairingCode(
    clientId: string,
    numberId: string,
    phoneNumber: string,
  ): Promise<string | null> {
    // Ensure session is started but not yet logged in
    const key = this.getSessionKey(clientId, numberId);
    if (!this.sessions.has(key)) {
      await this.startSession(clientId, numberId, phoneNumber);
      // Wait for socket to initialize
      await new Promise((r) => setTimeout(r, 2000));
    }

    const sock = this.sessions.get(key)?.sock;
    if (!sock) return null;

    try {
      // Normalize phone number
      const normalized = phoneNumber.replace(/[^0-9]/g, '');
      const code = await sock.requestPairingCode(normalized);
      return code;
    } catch (err) {
      console.error('requestPairingCode error:', err);
      return null;
    }
  }
}
