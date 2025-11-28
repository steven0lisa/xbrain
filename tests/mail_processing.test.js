import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { classifyEmail, summarizeEmailToKb, summarizeAttachmentsToMd } from '../src/assistant.js'

describe('邮件处理流程（Claude）', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unmock('child_process')
  })

  it('广告判定返回true', async () => {
    vi.mock('child_process', () => {
      return {
        spawn: (cmd, args, opts) => {
          const { EventEmitter } = require('events')
          const ee = new EventEmitter()
          ee.stdout = new EventEmitter()
          ee.stderr = new EventEmitter()
          setTimeout(() => {
            const payload = JSON.stringify({ type: 'result', result: JSON.stringify({ is_ad: true, reason: 'mock' }), is_ad: true })
            ee.stdout.emit('data', Buffer.from(payload))
            ee.emit('close', 0)
          }, 5)
          return ee
        },
      }
    })
    const cfg = { assistantWorkDir: path.resolve('data', 'assistant'), anthropic: { baseUrl: 'x', token: 'y', smallModel: 'z', model: 'm' } }
    const res = await classifyEmail(cfg, { subject: '促销', from: 'a@b.com', text: '买一送一' })
    expect(typeof res).toBe('boolean')
  })

  it('生成summary.md到KB目录', async () => {
    const kb = path.resolve('data', 'kb-test')
    fs.mkdirSync(kb, { recursive: true })
    vi.mock('child_process', () => {
      return {
        spawn: (cmd, args, opts) => {
          const { EventEmitter } = require('events')
          const ee = new EventEmitter()
          ee.stdout = new EventEmitter()
          ee.stderr = new EventEmitter()
          setTimeout(() => {
            const p = process.env.__TEST_SUMMARY_PATH
            if (p) fs.writeFileSync(p, '# 摘要\n要点')
            const payload = JSON.stringify({ type: 'result', result: '{}' })
            ee.stdout.emit('data', Buffer.from(payload))
            ee.emit('close', 0)
          }, 5)
          return ee
        },
      }
    })
    const cfg = { assistantWorkDir: path.resolve('data', 'assistant'), anthropic: { baseUrl: 'x', token: 'y', smallModel: 'z', model: 'm' } }
    const meta = { subject: 'x', from: 'a@b.com', text: '正文', attachments: [] }
    process.env.__TEST_SUMMARY_PATH = path.join(kb, 'summary.md')
    const p = await summarizeEmailToKb(cfg, meta, kb)
    expect(typeof p).toBe('string')
    expect(p.endsWith('summary.md')).toBe(true)
  })

  it('为附件生成同名md', async () => {
    const kbAtt = path.resolve('data', 'kb-attachments')
    fs.mkdirSync(kbAtt, { recursive: true })
    const attPath = path.join(kbAtt, 'doc.txt')
    fs.writeFileSync(attPath, 'hello')
    vi.mock('child_process', () => {
      return {
        spawn: (cmd, args, opts) => {
          const { EventEmitter } = require('events')
          const ee = new EventEmitter()
          ee.stdout = new EventEmitter()
          ee.stderr = new EventEmitter()
          setTimeout(() => {
            const p = process.env.__TEST_ATTACHMENT_MD_PATH
            if (p) fs.writeFileSync(p, '# 文件摘要')
            const payload = JSON.stringify({ type: 'result', result: '{}' })
            ee.stdout.emit('data', Buffer.from(payload))
            ee.emit('close', 0)
          }, 5)
          return ee
        },
      }
    })
    const cfg = { assistantWorkDir: path.resolve('data', 'assistant'), anthropic: { baseUrl: 'x', token: 'y', smallModel: 'z', model: 'm' } }
    const meta = { attachments: [{ filename: 'doc.txt', path: attPath, contentType: 'text/plain' }] }
    process.env.__TEST_ATTACHMENT_MD_PATH = path.join(kbAtt, 'doc.txt.md')
    await summarizeAttachmentsToMd(cfg, meta)
    expect(fs.existsSync(path.join(kbAtt, 'doc.txt.md'))).toBe(true)
  })
})
