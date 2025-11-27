import { loadConfig, ensureDirs, readState, writeState } from './config.js'
import { logger } from './logger.js'
import { fetchNewEmails } from './mail/imap.js'
import { sendReply } from './mail/smtp.js'
import { runAssistant } from './assistant.js'

function hasAssistantTrigger(email) {
  const t = (email.text || '') + (email.html || '') + (email.subject || '')
  return /@助手/.test(t)
}

async function processOnce(cfg, stateRef) {
  try {
    const emails = await fetchNewEmails(cfg, stateRef)
    for (const em of emails) {
      logger.info('新邮件入库', { subject: em.subject, from: em.from })
      const triggered = hasAssistantTrigger(em)
      logger.info('助手触发判定', { subject: em.subject, triggered })
      if (triggered) {
        logger.info('检测到@助手触发，调用Claude处理')
        try {
          const { replyText, replyHtml, attachments } = await runAssistant(cfg, em)
          if (String(replyText).trim() === 'NO_REPLY') {
            logger.info('助手判定无需回复，已跳过发送')
          } else {
            await sendReply(cfg, em, replyText, attachments, replyHtml)
            logger.info('邮件回复已发送', { to: em.from, subject: em.subject, attachments: (attachments||[]).length })
          }
        } catch (e) {
          logger.error('助手处理失败', { error: String(e), stack: e.stack })
        }
      }
      // 每处理完一封邮件就更新状态
      writeState(cfg, stateRef)
      logger.info('状态已写入', { lastUid: stateRef.lastUid })
    }
    // 最后再更新一次状态确保一致性
    writeState(cfg, stateRef)
  } catch (e) {
    logger.error('轮询处理异常', { error: String(e), stack: e.stack })
    // 即使出错也要更新状态
    try {
      writeState(cfg, stateRef)
    } catch (stateError) {
      logger.error('状态写入失败', { error: String(stateError) })
    }
  }
}

async function main() {
  const { cfg, missing } = loadConfig()
  ensureDirs(cfg)

  const isDry = process.env.DRY_RUN === '1'
  if (missing.length) {
    logger.error('环境变量缺失', { missing })
    if (!isDry) return
  }

  const state = readState(cfg)
  logger.info('启动邮件助手', { pollIntervalMs: cfg.pollIntervalMs, dryRun: isDry })
  if (isDry) {
    logger.info('DRY_RUN模式，已跳过网络连接与实际调用')
    return
  }

  // 立即执行一次
  await processOnce(cfg, state)

  // 设置定时器，并添加错误处理
  const timer = setInterval(async () => {
    try {
      await processOnce(cfg, state)
    } catch (e) {
      logger.error('定时轮询异常', { error: String(e), stack: e.stack })
    }
  }, cfg.pollIntervalMs)

  // 添加优雅退出处理
  process.on('SIGINT', () => {
    logger.info('收到SIGINT信号，正在退出...')
    clearInterval(timer)
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    logger.info('收到SIGTERM信号，正在退出...')
    clearInterval(timer)
    process.exit(0)
  })

  // 防止未捕获的异常导致程序退出
  process.on('uncaughtException', (e) => {
    logger.error('未捕获异常', { error: String(e), stack: e.stack })
  })

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝', { reason: String(reason), promise: String(promise) })
  })
}

main().catch(e => {
  console.error('主程序启动失败:', e)
  process.exit(1)
})
