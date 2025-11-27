import nodemailer from 'nodemailer'
import { logger } from '../logger.js'

export function createTransport(cfg) {
  return nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.secure,
    auth: cfg.smtp.auth,
  })
}

export async function sendReply(cfg, original, replyText, attachments = [], replyHtml = '') {
  const transport = createTransport(cfg)
  const mail = {
    from: cfg.smtp.auth.user,
    to: original.from,
    subject: `Re: ${original.subject || ''}`.trim(),
    text: replyText,
    html: replyHtml || undefined,
    inReplyTo: original.messageId || undefined,
    references: original.references?.length ? original.references : undefined,
    attachments: attachments.map(a => ({ filename: a.filename, path: a.path, contentType: a.contentType })),
  }
  const info = await transport.sendMail(mail)
  logger.info(`回复已发送: ${info.messageId}`)
  return info
}
