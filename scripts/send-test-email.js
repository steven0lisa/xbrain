import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve('.env.local') })
dotenv.config()

async function sendTestEmail() {
  // 配置SMTP（使用测试邮箱或其他SMTP服务）
  const transport = nodemailer.createTransport({
    host: 'smtp.163.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  })

  const mailOptions = {
    from: process.env.MAIL_USER,
    to: 'steven0lisa@163.com',
    subject: 'AI助手测试 - 系统负载查询',
    text: '@助手 请帮我查看当前系统的负载情况，包括CPU使用率、内存占用、磁盘使用情况等。',
    html: '<p>@助手 请帮我查看当前系统的负载情况，包括CPU使用率、内存占用、磁盘使用情况等。</p>',
  }

  try {
    const info = await transport.sendMail(mailOptions)
    console.log('测试邮件发送成功:', info.messageId)
    console.log('邮件ID:', info.messageId)
  } catch (error) {
    console.error('邮件发送失败:', error)
  }
}

sendTestEmail()