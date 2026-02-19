import { mkdirp } from 'fs-extra'
import { TEMP_DIR, ENV_DIR } from './constants'
require('../../vscode/mockModule')

const importModulesAfterMockingVsCode = () => {
  const { removeDir } = require('../../fileSystem')
  const { runMocha } = require('../util/mocha')
  const { setupTestVenv } = require('../../python')

  return { removeDir, runMocha, setupTestVenv }
}

const { setupTestVenv, removeDir, runMocha } = importModulesAfterMockingVsCode()

async function main() {
  try {
    await runMocha(
      __dirname,
      'ts',
      async () => {
        await mkdirp(TEMP_DIR)
        await setupTestVenv(
          TEMP_DIR,
          ENV_DIR,
          'dvc[s3] @ git+https://github.com/treeverse/dvc.git'
        )
      },
      () => {
        removeDir(TEMP_DIR)
      },
      30000
    )
  } catch {
    process.exit(1)
  }
}

void main()
