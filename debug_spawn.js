import { spawn } from 'child_process'

const child = spawn('claude', ['--version'], { stdio: 'inherit' })

child.on('error', (err) => {
  console.error('Spawn error:', err)
})

child.on('close', (code) => {
  console.log('Exited with code:', code)
})
