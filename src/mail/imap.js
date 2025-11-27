import fs from 'fs'
import path from 'path'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { logger } from '../logger.js'

export async function fetchNewEmails(cfg, stateRef) {
  const start = Date.now()
  const client = new ImapFlow({
    host: cfg.imap.host,
    port: cfg.imap.port,
    secure: cfg.imap.secure,
    auth: cfg.imap.auth,
    logger: false,
  })

  logger.info('IMAP正在连接服务器', { host: cfg.imap.host, port: cfg.imap.port })
  await client.connect()
  logger.info('IMAP连接成功')
  
  const lock = await client.getMailboxLock('INBOX')
  logger.info('IMAP锁获取成功')
  try {
    await client.mailboxOpen('INBOX')
    logger.info('IMAP邮箱打开成功')
    const status = await client.status('INBOX', { uidNext: true, messages: true, unseen: true })
    logger.info('IMAP邮箱状态', { messages: status.messages, uidNext: status.uidNext, unseen: status.unseen })
    
    let emails = []
    
    if (status.messages > 0) {
      logger.info('IMAP开始抓取邮件', { messages: status.messages })
      
      const uidRange = `${(stateRef.lastUid || 0) + 1}:*`
      logger.info('IMAP抓取UID范围', { range: uidRange })
      
      let fetchedCount = 0
      try {
        for await (const msg of client.fetch({ uid: uidRange }, { uid: true, source: true, envelope: true, flags: true })) {
          try {
            logger.info('IMAP处理邮件', { uid: msg.uid, size: msg.source?.length || 0 })
            const parsed = await simpleParser(msg.source)
            const uid = msg.uid
            
            if (uid <= (stateRef.lastUid || 0)) {
              logger.info('IMAP跳过已处理邮件', { uid, lastUid: stateRef.lastUid })
              continue
            }
            
            const id = `${(parsed.date || new Date()).toISOString().replace(/[:.]/g, '-')}-${uid}`
            const dir = path.join(cfg.kbDir, id)
            fs.mkdirSync(dir, { recursive: true })

            const metadata = {
              uid,
              subject: parsed.subject || '',
              from: parsed.from?.text || '',
              to: parsed.to?.text || '',
              date: parsed.date?.toISOString() || new Date().toISOString(),
              messageId: parsed.messageId || '',
              inReplyTo: parsed.inReplyTo || '',
              references: parsed.references || [],
              kbDir: dir,
              text: parsed.text || '',
              html: parsed.html || '',
              attachments: [],
            }

            if (parsed.attachments?.length) {
              for (const att of parsed.attachments) {
                const fname = safeFileName(att.filename || `attachment-${Date.now()}`)
                const fpath = path.join(dir, fname)
                fs.writeFileSync(fpath, att.content)
                metadata.attachments.push({ filename: fname, path: fpath, contentType: att.contentType })
              }
            }

            fs.writeFileSync(path.join(dir, 'email.json'), JSON.stringify(metadata, null, 2))
            if (metadata.text) fs.writeFileSync(path.join(dir, 'email.txt'), metadata.text)
            if (metadata.html) fs.writeFileSync(path.join(dir, 'email.html'), metadata.html)
            logger.info('IMAP落盘完成', { uid, kbDir: dir, attachments: metadata.attachments.length })

            emails.push(metadata)
            fetchedCount++
            logger.info('IMAP抓取UID成功', { uid, subject: metadata.subject, from: metadata.from })
            if (uid > (stateRef.lastUid || 0)) stateRef.lastUid = uid
            // 暂时跳过标记已读以确保流程完整性
            logger.info('跳过标记已读', { uid })
          } catch (ee) {
            logger.error('IMAP处理邮件失败', { uid: msg.uid, error: String(ee) })
          }
        }
        logger.info('IMAP抓取完成', { fetched: fetchedCount })
      } catch (fetchError) {
        logger.error('IMAP批量fetch失败', { error: String(fetchError) })
      }
    } else {
      logger.info('IMAP邮箱为空')
    }
    
    logger.info('IMAP查询完成', { fetched: emails.length, lastUid: stateRef.lastUid })

    if (emails.length > 0) {
      logger.info('IMAP保存状态', { lastUid: stateRef.lastUid })
    }

    const durationMs = Date.now() - start
    logger.info('IMAP会话结束', { fetched: emails.length, lastUid: stateRef.lastUid, durationMs })
    return emails
  } finally {
    lock.release()
    await client.logout()
    logger.info('IMAP已注销')
  }
}

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}
