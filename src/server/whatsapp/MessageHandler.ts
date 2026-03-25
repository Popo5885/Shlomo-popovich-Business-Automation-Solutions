import {
  WASocket,
  WAMessage,
  WAMessageKey,
  proto,
  getContentType,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { checkTimeBlocking } from '@/lib/shabbat';
import { QueueManager } from '../queue/QueueManager';
import { PollForwarder } from './PollForwarder';
import { DeleteSync } from './DeleteSync';
import type { BlockedHoursConfig } from '@/lib/shabbat';

export class MessageHandler {
  private clientId: string;
  private numberId: string;
  private sock: WASocket;

  constructor(clientId: string, numberId: string, sock: WASocket) {
    this.clientId = clientId;
    this.numberId = numberId;
    this.sock = sock;
  }

  async handle(msg: WAMessage): Promise<void> {
    // Ignore messages sent by this bot
    if (msg.key.fromMe) return;
    // Ignore status broadcasts
    if (msg.key.remoteJid === 'status@broadcast') return;

    const groupJid = msg.key.remoteJid;
    if (!groupJid?.endsWith('@g.us')) return; // Only group messages

    const senderPhone = msg.key.participant?.replace(/@.+/, '') || '';

    // Find campaigns that match this source group
    const [campaigns, systemSettings] = await Promise.all([
      prisma.campaign.findMany({
        where: {
          clientId: this.clientId,
          sourceGroupJid: groupJid,
          status: 'ACTIVE',
          triggerType: 'LISTENER',
        },
        include: {
          targets: true,
          client: {
            select: {
              blockedHours: true,
              dailyLimit: true,
              dailyMessageQuota: true,
              dailyUsage: true,
              allowedGroupJids: true,
            },
          },
        },
      }),
      prisma.systemSettings.findUnique({ where: { id: 'singleton' } }),
    ]);

    if (campaigns.length === 0) return;

    // Check authorized senders
    const sender = await prisma.authorizedSender.findFirst({
      where: { clientId: this.clientId, phoneNumber: senderPhone },
    });

    if (!sender) return; // Not an authorized sender

    for (const campaign of campaigns) {
      // Check time blocking & Shabbat
      const client = campaign.client;
      const effectiveBlockedHours = (client.blockedHours as BlockedHoursConfig | null) ??
        (systemSettings?.quietHours as BlockedHoursConfig | null);
      const timeCheck = checkTimeBlocking(
        effectiveBlockedHours,
        new Date(),
        systemSettings?.shabbatBlockEnabled ?? true,
      );

      if (timeCheck.blocked) {
        // Auto-reply
        await this.sock.sendMessage(groupJid, { text: timeCheck.message });
        return;
      }

      // Check quota (per-client override takes precedence over default limit)
      const effectiveDailyLimit = client.dailyMessageQuota ?? client.dailyLimit;
      if (client.dailyUsage >= effectiveDailyLimit) {
        await this.sock.sendMessage(groupJid, {
          text: 'מכסת ההודעות היומית הגיעה לסיומה. פנה למנהל המערכת.',
        });
        return;
      }

      // Check if sender has FREE_SENDING permission or ADMIN
      const hasFreeAccess =
        sender.permissions.includes('FREE_SENDING') || sender.permissions.includes('ADMIN');

      // Filter targets: client-level allowedGroupJids restriction (empty = allow all)
      let targets: typeof campaign.targets = campaign.targets;
      if (client.allowedGroupJids.length > 0) {
        targets = targets.filter((t) => client.allowedGroupJids.includes(t.groupJid));
        if (targets.length === 0) return;
      }

      // Sender-level group access restriction
      const allowedGroups = sender.groupAccess;
      if (allowedGroups.length > 0) {
        targets = targets.filter((t) => allowedGroups.includes(t.groupJid));
        if (targets.length === 0) return;
      }

      // Use filtered targets for this broadcast
      const filteredCampaign = { ...campaign, targets };

      // Detect if message is a poll
      const contentType = getContentType(msg.message!);
      if (contentType === 'pollCreationMessage' || contentType === 'pollCreationMessageV2' || contentType === 'pollCreationMessageV3') {
        const pollForwarder = new PollForwarder(this.sock, this.clientId);
        await pollForwarder.forward(msg, filteredCampaign);
        continue;
      }

      if (hasFreeAccess || !campaign.requireApproval) {
        // Direct broadcast
        await this.enqueueBroadcast(msg, filteredCampaign);
      } else {
        // Need admin approval
        await this.requestApproval(msg, filteredCampaign, senderPhone);
      }
    }
  }

  private async enqueueBroadcast(msg: WAMessage, campaign: { id: string; targets: { groupJid: string; numberId: string | null }[]; textSuffix: string | null; mediaSuffix: string | null }): Promise<void> {
    const qm = QueueManager.getInstance();
    await qm.enqueueBroadcast({
      clientId: this.clientId,
      sendingNumberId: this.numberId,
      msg,
      campaign,
    });
  }

  private async requestApproval(msg: WAMessage, campaign: { id: string; sourceGroupJid: string; targets: { groupJid: string }[] }, senderPhone: string): Promise<void> {
    // Store pending approval in Redis (TTL: 10 minutes)
    const approvalId = `approval:${this.clientId}:${Date.now()}`;
    const approvalData = {
      clientId: this.clientId,
      numberId: this.numberId,
      campaignId: campaign.id,
      senderPhone,
      msgKey: JSON.stringify(msg.key),
      msgContent: JSON.stringify(msg.message),
      targetCount: campaign.targets.length,
    };

    await redis.setex(approvalId, 600, JSON.stringify(approvalData));

    // Find admin sender
    const adminSender = await prisma.authorizedSender.findFirst({
      where: { clientId: this.clientId, permissions: { has: 'ADMIN' } },
    });

    if (!adminSender) return;

    const adminJid = `${adminSender.phoneNumber}@s.whatsapp.net`;
    const targetCount = campaign.targets.length;

    // Send approval request with buttons
    await this.sock.sendMessage(adminJid, {
      text: `📤 *בקשת שידור חדשה*\n\nשולח: ${senderPhone}\nקמפיין: ${campaign.id}\nמספר קבוצות יעד: ${targetCount}\n\nאנא השב:\n✅ *אשר* - לאשר שידור\n❌ *בטל* - לבטל`,
      contextInfo: {
        forwardingScore: 0,
        isForwarded: false,
      },
    } as Parameters<WASocket['sendMessage']>[1]);

    // Also store approval key in session data for response tracking
    await redis.setex(`pending_approval:${this.clientId}:${adminSender.phoneNumber}`, 600, approvalId);
  }

  async handleDelete(key: WAMessageKey): Promise<void> {
    const deleteSync = new DeleteSync(this.sock, this.clientId);
    await deleteSync.sync(key);
  }
}
