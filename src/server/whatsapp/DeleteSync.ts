import { WASocket, WAMessageKey } from '@whiskeysockets/baileys';
import { prisma } from '@/lib/prisma';

export class DeleteSync {
  private sock: WASocket;
  private clientId: string;

  constructor(sock: WASocket, clientId: string) {
    this.sock = sock;
    this.clientId = clientId;
  }

  async sync(deletedKey: WAMessageKey): Promise<void> {
    const sourceMsgId = deletedKey.id;
    if (!sourceMsgId) return;

    // Find all target messages mapped to this source message
    const mappings = await prisma.messageMapping.findMany({
      where: { clientId: this.clientId, sourceMsgId },
    });

    if (mappings.length === 0) return;

    console.log(`🗑️  DeleteSync: removing ${mappings.length} messages for source ${sourceMsgId}`);

    for (const mapping of mappings) {
      try {
        const targetKey = mapping.targetMsgKey as {
          id: string;
          remoteJid: string;
          fromMe: boolean;
          participant?: string;
        };

        await this.sock.sendMessage(mapping.targetGroupJid, {
          delete: {
            id: targetKey.id,
            remoteJid: targetKey.remoteJid,
            fromMe: targetKey.fromMe,
            participant: targetKey.participant,
          },
        });

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error(`DeleteSync error for ${mapping.targetGroupJid}:`, err);
      }
    }

    // Clean up mappings
    await prisma.messageMapping.deleteMany({
      where: { clientId: this.clientId, sourceMsgId },
    });
  }
}
