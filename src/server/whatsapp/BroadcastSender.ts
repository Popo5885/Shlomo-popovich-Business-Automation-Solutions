import {
  WASocket,
  WAMessage,
  proto,
  getContentType,
  AnyMessageContent,
} from '@whiskeysockets/baileys';
import { prisma } from '@/lib/prisma';

interface BroadcastJob {
  clientId: string;
  targetGroupJid: string;
  msg: WAMessage;
  textSuffix?: string | null;
  mediaSuffix?: string | null;
  sourceMsgId: string;
  sourceGroupJid: string;
}

export class BroadcastSender {
  private sock: WASocket;

  constructor(sock: WASocket) {
    this.sock = sock;
  }

  async send(job: BroadcastJob): Promise<string | null> {
    const { clientId, targetGroupJid, msg, textSuffix, mediaSuffix, sourceMsgId, sourceGroupJid } =
      job;

    const content = msg.message;
    if (!content) return null;

    const contentType = getContentType(content);
    let sentMsg: proto.IWebMessageInfo | undefined;

    try {
      const preparedContent = this.prepareContent(content, contentType, targetGroupJid, {
        textSuffix,
        mediaSuffix,
        // Inject group-specific link from DB
        groupLink: await this.getGroupLink(clientId, targetGroupJid),
      });

      sentMsg = await this.sock.sendMessage(targetGroupJid, preparedContent);

      if (sentMsg?.key) {
        // Save message mapping for delete sync
        await prisma.messageMapping.create({
          data: {
            clientId,
            sourceMsgId,
            sourceGroupJid,
            targetGroupJid,
            targetMsgId: sentMsg.key.id!,
            targetMsgKey: {
              id: sentMsg.key.id,
              remoteJid: sentMsg.key.remoteJid,
              fromMe: sentMsg.key.fromMe,
              participant: sentMsg.key.participant,
            },
          },
        });

        // Increment usage counter
        await prisma.client.update({
          where: { id: clientId },
          data: { dailyUsage: { increment: 1 }, monthlyUsage: { increment: 1 } },
        });

        return sentMsg.key.id!;
      }
    } catch (err) {
      console.error(`BroadcastSender error to ${targetGroupJid}:`, err);
      throw err;
    }

    return null;
  }

  private prepareContent(
    content: proto.IMessage,
    contentType: string | undefined,
    targetGroupJid: string,
    opts: {
      textSuffix?: string | null;
      mediaSuffix?: string | null;
      groupLink?: string | null;
    },
  ): AnyMessageContent {
    const { textSuffix, mediaSuffix, groupLink } = opts;

    if (contentType === 'conversation' || contentType === 'extendedTextMessage') {
      let text =
        content.conversation ||
        content.extendedTextMessage?.text ||
        '';

      // "#" no-link tag: if text ends with #, strip it and skip link
      const noLink = text.endsWith('#');
      if (noLink) {
        text = text.slice(0, -1).trim();
      } else {
        if (groupLink) text = `${text}\n${groupLink}`;
        if (textSuffix) text = `${text}\n${textSuffix}`;
      }

      return { text };
    }

    if (
      contentType === 'imageMessage' ||
      contentType === 'videoMessage' ||
      contentType === 'documentMessage' ||
      contentType === 'audioMessage'
    ) {
      const mediaMsg = (content as Record<string, proto.Message.IImageMessage | proto.Message.IVideoMessage | proto.Message.IDocumentMessage | proto.Message.IAudioMessage>)[contentType!];
      let caption = (mediaMsg as proto.Message.IImageMessage)?.caption || '';

      const noLink = caption.endsWith('#');
      if (noLink) {
        caption = caption.slice(0, -1).trim();
      } else {
        if (groupLink) caption = `${caption}\n${groupLink}`;
        if (mediaSuffix) caption = `${caption}\n${mediaSuffix}`;
      }

      // Forward the media message with updated caption
      return {
        forward: {
          key: { remoteJid: targetGroupJid, fromMe: false, id: 'forward' },
          message: {
            ...content,
            [contentType!]: { ...mediaMsg, caption },
          },
        },
      } as unknown as AnyMessageContent;
    }

    // For other content types, forward as-is
    return { forward: { key: { remoteJid: targetGroupJid, fromMe: false, id: 'fwd' }, message: content } } as unknown as AnyMessageContent;
  }

  private async getGroupLink(clientId: string, jid: string): Promise<string | null> {
    const group = await prisma.group.findUnique({
      where: { clientId_jid: { clientId, jid } },
      select: { customLink: true },
    });
    return group?.customLink || null;
  }
}
