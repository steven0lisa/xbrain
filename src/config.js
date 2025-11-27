import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve('.env.local') })
dotenv.config()

function requireEnv(name, fallback = undefined) {
  const v = process.env[name]
  if (v && v.length > 0) return v
  if (fallback !== undefined) return fallback
  return undefined
}

export function loadConfig() {
  const cfg = {
    pollIntervalMs: Number(requireEnv('POLL_INTERVAL_MS', 60000)),
    claudeBin: requireEnv('CLAUDE_BIN', 'claude'),
    imap: {
      host: requireEnv('IMAP_HOST', 'imap.163.com'),
      port: Number(requireEnv('IMAP_PORT', 993)),
      secure: true,
      auth: {
        user: requireEnv('MAIL_USER'),
        pass: requireEnv('MAIL_PASS'),
      },
    },
    smtp: {
      host: requireEnv('SMTP_HOST', 'smtp.163.com'),
      port: Number(requireEnv('SMTP_PORT', 465)),
      secure: true,
      auth: {
        user: requireEnv('MAIL_USER'),
        pass: requireEnv('MAIL_PASS'),
      },
    },
    kbDir: path.resolve('data', 'kb'),
    stateFile: path.resolve('data', 'state.json'),
    assistantWorkDir: path.resolve('data', 'assistant'),
    anthropic: {
      baseUrl: requireEnv('ANTHROPIC_BASE_URL'),
      token: requireEnv('ANTHROPIC_AUTH_TOKEN'),
      smallModel: requireEnv('ANTHROPIC_SMALL_FAST_MODEL'),
      model: requireEnv('ANTHROPIC_MODEL'),
    },
  }

  const missing = []
  if (!cfg.imap.auth.user) missing.push('MAIL_USER')
  if (!cfg.imap.auth.pass) missing.push('MAIL_PASS')
  if (!cfg.anthropic.baseUrl) missing.push('ANTHROPIC_BASE_URL')
  if (!cfg.anthropic.token) missing.push('ANTHROPIC_AUTH_TOKEN')
  if (!cfg.anthropic.smallModel) missing.push('ANTHROPIC_SMALL_FAST_MODEL')
  if (!cfg.anthropic.model) missing.push('ANTHROPIC_MODEL')

  return { cfg, missing }
}

export function ensureDirs(cfg) {
  for (const d of [cfg.kbDir, cfg.assistantWorkDir, path.dirname(cfg.stateFile)]) {
    fs.mkdirSync(d, { recursive: true })
  }
}

export function readState(cfg) {
  try {
    const raw = fs.readFileSync(cfg.stateFile, 'utf8')
    return JSON.parse(raw)
  } catch {
    return { lastUid: 0 }
  }
}

export function writeState(cfg, state) {
  fs.writeFileSync(cfg.stateFile, JSON.stringify(state, null, 2))
}
