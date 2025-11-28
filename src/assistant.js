import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import os from 'os'
import { logger } from './logger.js'

export async function runAssistant(cfg, emailMeta, sessionIdOverride) {
  const sessionId = sessionIdOverride || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const workDir = path.join(cfg.assistantWorkDir, sessionId)
  fs.mkdirSync(workDir, { recursive: true })

  const prompt = buildPrompt(emailMeta, workDir)
  const knownNames = prepareWorkdir(workDir, emailMeta, prompt)

  const env = {
    ...process.env,
    ANTHROPIC_BASE_URL: cfg.anthropic.baseUrl || '',
    ANTHROPIC_AUTH_TOKEN: cfg.anthropic.token || '',
    ANTHROPIC_API_KEY: cfg.anthropic.token || '',
    ANTHROPIC_SMALL_FAST_MODEL: cfg.anthropic.smallModel || '',
    ANTHROPIC_MODEL: cfg.anthropic.model || '',
  }

  const bin = expandBin(cfg.claudeBin || 'claude')
  const args = ['--output-format', 'json', '--allowedTools', 'Bash,Read', '--permission-mode', 'acceptEdits', '--dangerously-skip-permissions']
  if (cfg.anthropic.model) args.push('--model', cfg.anthropic.model)
  logger.info('Claude环境变量', { baseUrl: env.ANTHROPIC_BASE_URL || '', hasApiKey: !!env.ANTHROPIC_API_KEY })
  logger.info('调用Claude Code', { bin, args })
  let resultJson
  try {
    resultJson = await runCmd(bin, args, { cwd: workDir, env }, 180000, prompt)
  } catch (e) {
    logger.error('首选Claude二进制调用失败，尝试回退到系统claude', { error: String(e) })
    resultJson = await runCmd('claude', args, { cwd: workDir, env }, 180000, prompt)
  }
  let replyText = ''
  let replyHtml = ''
  try {
    const parsed = JSON.parse(resultJson)
    if (Array.isArray(parsed)) {
      const last = parsed.reverse().find(m => m.type === 'result') || parsed[parsed.length - 1]
      replyText = String(last && last.result ? last.result : '').trim()
      const plan = parsePlan(replyText)
      if (plan.noReply) {
        return { replyText: 'NO_REPLY', replyHtml: '', attachments: [] }
      }
      if (plan.replyFile) {
        const body = readBodyFromFile(plan.replyFile)
        replyText = body.text
        replyHtml = body.html
        const knownReplyBase = path.basename(plan.replyFile)
        const planAttachments = normalizeAttachments(plan.attachments)
        const autoAttachments = listNewFiles(workDir, [...knownNames, 'reply.txt', 'reply_email.md', 'reply_email.html', knownReplyBase])
        const combined = planAttachments.length ? mergeAttachments(planAttachments, autoAttachments) : autoAttachments
        return { replyText, replyHtml, attachments: combined }
      }
    } else {
      replyText = String(parsed.result || '').trim()
      const plan = parsePlan(replyText)
      if (plan.noReply) {
        return { replyText: 'NO_REPLY', replyHtml: '', attachments: [] }
      }
      if (plan.replyFile) {
        const body = readBodyFromFile(plan.replyFile)
        replyText = body.text
        replyHtml = body.html
        const knownReplyBase = path.basename(plan.replyFile)
        const planAttachments = normalizeAttachments(plan.attachments)
        const autoAttachments = listNewFiles(workDir, [...knownNames, 'reply.txt', 'reply_email.md', 'reply_email.html', knownReplyBase])
        const combined = planAttachments.length ? mergeAttachments(planAttachments, autoAttachments) : autoAttachments
        return { replyText, replyHtml, attachments: combined }
      }
    }
  } catch (e) {
    logger.error('解析Claude结果失败，使用原始文本', { error: String(e) })
    const m = /"result"\s*:\s*"([\s\S]*?)"\s*[,}]/.exec(resultJson)
    replyText = m ? m[1] : resultJson.slice(0, 10000)
  }

  try {
    fs.writeFileSync(path.join(workDir, 'reply.txt'), replyText)
  } catch {}
  const { textFromFiles, htmlFromFiles } = readReplyFiles(workDir)
  if (textFromFiles) replyText = textFromFiles
  if (htmlFromFiles) replyHtml = htmlFromFiles
  const generatedAttachments = listNewFiles(workDir, [...knownNames, 'reply.txt', 'reply_email.md', 'reply_email.html'])
  return { replyText, replyHtml, attachments: generatedAttachments }
}

function buildPrompt(emailMeta, workDir) {
  const attList = (emailMeta.attachments || []).map(a => `- ${a.filename}`).join('\n')
  const text = emailMeta.text || ''
  const htmlSummary = emailMeta.html ? '(邮件包含HTML内容)' : ''
  return [
    '你是公司邮件助手。基于邮件正文与附件，生成专业的中文回复。',
    '要求：',
    '- 使用清晰结构，必要时给出步骤与结论。',
    '- 如需生成数据文件、图表或图片，请在当前工作目录创建文件并给出文件名。',
    '- 判断是否需要回复邮件：若与助手无关或无需回复，输出"NO_REPLY"（仅此内容）。',
    '- 若需要回复邮件：请在当前工作目录生成回复正文文件，文件名建议 reply_email.html（优先）或 reply_email.md。',
    '- 结果输出格式（严格）：返回JSON对象字符串，包含字段：',
    '  { "reply": "REPLY", "reply_file": "<绝对路径>", "format": "html|md|txt", "attachments": [{"path":"<绝对路径>","filename":"<可选>","contentType":"<可选>"}] }',
    '- 若引用了文件或邮件作为数据或资料来源，且单个文件大小小于10MB，请将该文件以附件形式随回复邮件一并发送，便于发件人核验信息来源（请在 attachments 中列出绝对路径）。',
    '- 如需附加回复附件，请完整填写 attachments 数组，path 必须是绝对路径；若无需附件可省略该字段或给空数组。',
    '- 若无需回复则只输出字符串 NO_REPLY，不输出其他任何内容。',
    `工作目录：${workDir}`,
    '原邮件：',
    `发件人：${emailMeta.from}`,
    `主题：${emailMeta.subject}`,
    `文本：\n${text}`,
    `${htmlSummary}`,
    '附件列表：\n' + (attList || '无'),
  ].join('\n')
}

function runCmd(cmd, args, opts, timeoutMs = 120000, stdinData) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let done = false
    try {
      if (stdinData && child.stdin && typeof child.stdin.write === 'function') {
        child.stdin.write(stdinData)
        child.stdin.end()
      }
    } catch {}

    child.stdout.on('data', d => {
      stdout += d.toString()
      // 检测多种可能的结束模式
      if (!done && (/"type"\s*:\s*"result"/.test(stdout) || /"result"\s*:/.test(stdout))) {
        logger.info('检测到Claude输出结果，准备结束进程')
        done = true
        try { child.kill('SIGKILL') } catch {}
        resolve(stdout)
      }
    })

    child.stderr.on('data', d => (stderr += d.toString()))
    child.on('error', reject)

    const timer = setTimeout(() => {
      if (!done) {
        logger.error('Claude调用超时', { timeoutMs, stdoutLength: stdout.length, stderrLength: stderr.length })
        done = true
        try { child.kill('SIGKILL') } catch {}
        reject(new Error(`Claude调用超时 (${timeoutMs}ms)`))
      }
    }, timeoutMs)

    child.on('close', code => {
      clearTimeout(timer)
      if (done) return
      done = true
      if (code === 0) {
        resolve(stdout)
      } else {
        logger.error('Claude进程异常退出', { code, stderr: stderr.slice(0, 500) })
        reject(new Error(`Claude进程退出码: ${code}, stderr: ${stderr.slice(0, 200)}`))
      }
    })
  })
}

function expandBin(p) {
  if (!p) return 'claude'
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2))
  return p
}

// quoting helper removed for param mode

// removed shell build helper

function listNewFiles(dir, knownNames) {
  const names = fs.readdirSync(dir)
  const known = new Set(Array.isArray(knownNames) ? knownNames : ['stdin.txt'])
  const out = []
  for (const name of names) {
    if (known.has(name)) continue
    const full = path.join(dir, name)
    try {
      const st = fs.statSync(full)
      if (st.isFile()) out.push({ filename: name, path: full })
    } catch {}
  }
  return out
}

function prepareWorkdir(workDir, emailMeta, prompt) {
  const known = []
  try {
    fs.writeFileSync(path.join(workDir, 'stdin.txt'), prompt)
    known.push('stdin.txt')
  } catch {}
  try {
    if (emailMeta.text) {
      fs.writeFileSync(path.join(workDir, 'email.txt'), emailMeta.text)
      known.push('email.txt')
    }
  } catch {}
  try {
    if (emailMeta.html) {
      fs.writeFileSync(path.join(workDir, 'email.html'), emailMeta.html)
      known.push('email.html')
    }
  } catch {}
  try {
    for (const a of emailMeta.attachments || []) {
      const src = a.path
      if (!src) continue
      const name = a.filename || path.basename(src)
      const dest = path.join(workDir, name)
      try {
        fs.copyFileSync(src, dest)
        known.push(name)
      } catch {}
    }
  } catch {}
  return known
}

function readReplyFiles(workDir) {
  let md = ''
  let html = ''
  try {
    const pHtml = path.join(workDir, 'reply_email.html')
    if (fs.existsSync(pHtml)) {
      html = fs.readFileSync(pHtml, 'utf8')
    }
  } catch {}
  try {
    const pMd = path.join(workDir, 'reply_email.md')
    if (fs.existsSync(pMd)) {
      md = fs.readFileSync(pMd, 'utf8')
      if (!html) html = mdToHtml(md)
    }
  } catch {}
  const text = md || ''
  return { textFromFiles: text, htmlFromFiles: html }
}

function mdToHtml(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let inList = false
  for (let line of lines) {
    if (/^\s*-\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true }
      const item = line.replace(/^\s*-\s+/, '')
      out.push(`<li>${inlineMd(item)}</li>`)
      continue
    }
    if (inList) { out.push('</ul>'); inList = false }
    if (/^#{1,6}\s/.test(line)) {
      const level = (line.match(/^#+/) || [''])[0].length
      const text = line.replace(/^#{1,6}\s*/, '')
      out.push(`<h${level}>${inlineMd(text)}</h${level}>`)
      continue
    }
    if (line.trim() === '') { out.push(''); continue }
    out.push(`<p>${inlineMd(line)}</p>`)
  }
  if (inList) out.push('</ul>')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#222} h1,h2,h3{margin:0.6em 0} p{margin:0.5em 0} ul{padding-left:1.2em} code{background:#f5f5f7;padding:0 3px;border-radius:3px}</style></head><body>${out.join('\n')}</body></html>`
  function inlineMd(s) {
    let t = esc(s)
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
    return t
  }
}

function parsePlan(s) {
  const t = String(s || '').trim()
  if (t === 'NO_REPLY') return { noReply: true }
  try {
    const obj = typeof t === 'string' ? JSON.parse(t) : t
    if (obj && obj.reply === 'REPLY' && obj.reply_file) {
      return { noReply: false, replyFile: obj.reply_file, format: obj.format, attachments: Array.isArray(obj.attachments) ? obj.attachments : [] }
    }
  } catch {}
  return { noReply: false }
}

function readBodyFromFile(p) {
  let text = ''
  let html = ''
  try {
    const ext = path.extname(p).toLowerCase()
    const content = fs.readFileSync(p, 'utf8')
    if (ext === '.html' || ext === '.htm') html = content
    else if (ext === '.md') { text = content; html = mdToHtml(content) }
    else text = content
  } catch {}
  return { text, html }
}

function normalizeAttachments(arr) {
  const out = []
  for (const a of arr || []) {
    if (!a || !a.path) continue
    const full = String(a.path)
    try {
      const st = fs.statSync(full)
      if (!st.isFile()) continue
    } catch { continue }
    out.push({ filename: a.filename || path.basename(full), path: full, contentType: a.contentType })
  }
  return out
}

function mergeAttachments(primary, secondary) {
  const seen = new Set()
  const result = []
  for (const a of [...primary, ...secondary]) {
    const key = a.path || a.filename
    if (key && !seen.has(key)) {
      seen.add(key)
      result.push(a)
    }
  }
  return result
}
