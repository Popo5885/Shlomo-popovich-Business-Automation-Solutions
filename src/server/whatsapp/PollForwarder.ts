import { WASocket, WAMessage, proto } from '@whiskeysockets/baileys';
import { prisma } from '@/lib/prisma';

interface CampaignWithTargets {
  id: string;
  targets: { groupJid: string }[];
  textSuffix?: string | null;
}

export class PollForwarder {
  private sock: WASocket;
  private clientId: string;

  constructor(sock: WASocket, clientId: string) {
    this.sock = sock;
    this.clientId = clientId;
  }

  async forward(msg: WAMessage, campaign: CampaignWithTargets): Promise<void> {
    const content = msg.message;
    if (!content) return;

    // Extract poll data from any poll message version
    const pollMsg =
      content.pollCreationMessage ||
      content.pollCreationMessageV2 ||
      content.pollCreationMessageV3;

    if (!pollMsg) return;

    const question = pollMsg.name || 'סקר';
    const options = (pollMsg.options || []).map((o) => o.optionName || '').filter(Boolean);
    const selectableCount = (pollMsg as proto.IPollCreationMessage).selectableOptionsCount || 1;

    console.log(`📊 PollForwarder: forwarding poll "${question}" to ${campaign.targets.length} groups`);

    for (const target of campaign.targets) {
      try {
        const sentMsg = await this.sock.sendMessage(target.groupJid, {
          poll: {
            name: question,
            values: options,
            selectableCount,
          },
        });

        if (sentMsg?.key) {
          await prisma.messageMapping.create({
            data: {
              clientId: this.clientId,
              sourceMsgId: msg.key.id!,
              sourceGroupJid: msg.key.remoteJid!,
              targetGroupJid: target.groupJid,
              targetMsgId: sentMsg.key.id!,
              targetMsgKey: {
                id: sentMsg.key.id,
                remoteJid: sentMsg.key.remoteJid,
                fromMe: sentMsg.key.fromMe,
                participant: sentMsg.key.participant,
              },
            },
          });
        }

        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        console.error(`PollForwarder error to ${target.groupJid}:`, err);
      }
    }
  }
}
