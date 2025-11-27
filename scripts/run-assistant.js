import { loadConfig, ensureDirs } from '../src/config.js'
import { runAssistant } from '../src/assistant.js'

async function main() {
  const { cfg } = loadConfig()
  ensureDirs(cfg)
  const emailMeta = {
    from: 'steven0lisa@live.com',
    subject: 'EISDIR 验证',
    text: '@助手 请生成一段测试回复，并在工作目录创建一个report.txt文件。',
    attachments: [],
  }
  try {
    const { replyText, attachments } = await runAssistant(cfg, emailMeta)
    console.log('Reply text length:', replyText.length)
    console.log('Attachments:', attachments)
    console.log('Reply preview:', replyText.slice(0, 200))
  } catch (e) {
    console.error('Assistant error:', e && e.stack ? e.stack : String(e))
    process.exit(1)
  }
}

main()
