import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// ESM import of the module under test
import { runAssistant } from '../src/assistant.js'

describe('Claude Code 调用', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('在模拟spawn成功时返回解析的文本与生成附件', async () => {
    const tempRoot = path.resolve('data', 'assistant')
    fs.mkdirSync(tempRoot, { recursive: true })

    vi.mock('child_process', () => {
      return {
        spawn: (cmd, args, opts) => {
          const { EventEmitter } = require('events')
          const ee = new EventEmitter()
          ee.stdout = new EventEmitter()
          ee.stderr = new EventEmitter()
          setTimeout(() => {
            const outFile = path.join(opts.cwd, 'report.txt')
            fs.writeFileSync(outFile, 'hello')
            const payload = JSON.stringify({ type: 'result', result: '测试回复内容' })
            ee.stdout.emit('data', Buffer.from(payload))
            ee.emit('close', 0)
          }, 10)
          return ee
        },
      }
    })

    const cfg = {
      assistantWorkDir: tempRoot,
      anthropic: { baseUrl: 'x', token: 'y', smallModel: 'z', model: 'm' },
    }
    const emailMeta = { subject: 't', from: 'a@b.com', text: 'hi' }

    const res = await runAssistant(cfg, emailMeta, 'unit-test-session')
    expect(res.replyText).toContain('测试回复内容')
    expect(Array.isArray(res.attachments)).toBe(true)
    expect(res.attachments.some(a => a.filename === 'report.txt')).toBe(true)
  })

  it.skip('在真实安装claude时返回成功结果', async () => {
    if (process.env.CLAUDE_E2E !== '1') return
    const cfg = {
      assistantWorkDir: path.resolve('data', 'assistant'),
      anthropic: {
        baseUrl: process.env.ANTHROPIC_BASE_URL,
        token: process.env.ANTHROPIC_AUTH_TOKEN,
        smallModel: process.env.ANTHROPIC_SMALL_FAST_MODEL,
        model: process.env.ANTHROPIC_MODEL,
      },
    }
    const emailMeta = { subject: 'e2e', from: 'u@d.com', text: '测试' }
    const res = await runAssistant(cfg, emailMeta, 'e2e-session')
    expect(res.replyText.length).toBeGreaterThan(0)
  })
})
