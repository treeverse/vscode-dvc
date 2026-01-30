import { execSync } from 'child_process'
import { resolve } from 'path'

const demoDir = resolve(__dirname, '..', 'demo')

execSync('uv sync', {
  cwd: demoDir,
  stdio: 'inherit',
  env: { ...process.env, UV_PROJECT_ENVIRONMENT: '.env' }
})
