import fs from 'fs'
import path from 'path'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

const logDir = path.resolve('logs')
fs.mkdirSync(logDir, { recursive: true })

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const m = typeof message === 'string' ? message : JSON.stringify(message)
      const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
      return `${timestamp} [${level}] ${m}${extra}`
    })
  ),
  transports: [
    new winston.transports.Console({}),
    new DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
})
