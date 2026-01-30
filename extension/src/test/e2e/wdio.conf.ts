import { join, resolve } from 'node:path'
import url from 'node:url'
import { mkdirp } from 'fs-extra'
import { Options } from '@wdio/types'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const getVenvBinPath = (cwd: string, envDir: string, name: string) =>
  process.platform === 'win32'
    ? join(cwd, envDir, 'Scripts', `${name}.exe`)
    : join(cwd, envDir, 'bin', name)

const screenshotDir = join(__dirname, 'screenshots')
const logsDir = join(__dirname, 'logs')
const extensionPath = resolve(__dirname, '..', '..', '..')
const dvcDemoPath = resolve(extensionPath, '..', 'demo')

export const config: Options.Testrunner = {
  after: async function () {
    await browser.switchToFrame(null)
    await browser.switchToFrame(null)
  },
  afterTest: async (test, __, { passed }) => {
    if (passed) {
      return
    }

    // eslint-disable-next-line no-console
    console.log('Capturing screenshot for debugging')

    await browser.saveScreenshot(
      join(screenshotDir, `${test.parent} - ${test.title}.png`)
    )
  },
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: join(__dirname, 'tsconfig.json'),
      transpileOnly: true
    }
  },
  baseUrl: 'http://localhost',
  before: async function () {
    mkdirp(screenshotDir)
    await browser.setWindowSize(1600, 1200)
  },
  capabilities: [
    {
      browserName: 'vscode',
      browserVersion: '1.108.1',
      'wdio:vscodeOptions': {
        extensionPath,
        userSettings: {
          'dvc.pythonPath': getVenvBinPath(dvcDemoPath, '.env', 'python'),
          'window.commandCenter': false
        },
        verboseLogging: false,
        workspacePath: dvcDemoPath
      }
    }
  ],
  connectionRetryCount: 3,
  connectionRetryTimeout: 120000,
  framework: 'mocha',
  maxInstances: 1,
  mochaOpts: {
    bail: true,
    parallel: false,
    retries: 0,
    timeout: 60000,
    ui: 'bdd'
  },
  outputDir: logsDir,
  reporters: ['spec'],
  services: ['vscode'],
  specs: ['./*.test.ts'],
  waitforTimeout: 10000
}
