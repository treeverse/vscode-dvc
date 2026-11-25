import { join } from 'path'
import { EventEmitter } from 'vscode'
import { Disposable, Disposer } from '@hediet/std/disposable'
import { DOT_DVC, Flag, UNEXPECTED_ERROR_CODE } from './constants'
import { EXPERIMENT_WORKSPACE_ID } from './contract'
import { DvcReader } from './reader'
import { CliResult, CliStarted } from '..'
import { MaybeConsoleError } from '../error'
import { createProcess } from '../../process/execution'
import { getFailingMockedProcess, getMockedProcess } from '../../test/util/jest'
import { getProcessEnv } from '../../env'
import expShowFixture from '../../test/fixtures/expShow/base/output'
import plotsDiffFixture from '../../test/fixtures/plotsDiff/output/minimal'
import { Config } from '../../config'
import { joinEnvPath } from '../../util/env'
import { dvcDemoPath } from '../../test/util'
import { Toast } from '../../vscode/toast'

jest.mock('vscode')
jest.mock('@hediet/std/disposable')
jest.mock('fs')
jest.mock('../../process/execution')
jest.mock('../../env')
jest.mock('../../common/logger')

const mockedDisposable = jest.mocked(Disposable)

const mockedCreateProcess = jest.mocked(createProcess)
const mockedGetProcessEnv = jest.mocked(getProcessEnv)
const mockedEnv = {
  DVCLIVE_OPEN: 'false',
  DVC_NO_ANALYTICS: 'true',
  GIT_TERMINAL_PROMPT: '0',
  PATH: '/all/of/the/goodies:/in/my/path'
}
const JSON_FLAG = '--json'

const mockedGetPythonBinPath = jest.fn()
const mockedGetPYTHONPATH = jest.fn()

beforeEach(() => {
  jest.resetAllMocks()
  mockedGetProcessEnv.mockReturnValueOnce(mockedEnv)
})

describe('DvcReader', () => {
  mockedDisposable.fn.mockReturnValueOnce({
    track: function <T>(disposable: T): T {
      return disposable
    },
    untrack: function <T>(disposable: T): T {
      return disposable
    }
  } as unknown as (() => void) & Disposer)

  const dvcReader = new DvcReader(
    {
      getCliPath: () => undefined,
      getPYTHONPATH: mockedGetPYTHONPATH,
      getPythonBinPath: mockedGetPythonBinPath
    } as unknown as Config,
    {
      processCompleted: {
        event: jest.fn(),
        fire: jest.fn()
      } as unknown as EventEmitter<CliResult>,
      processStarted: {
        event: jest.fn(),
        fire: jest.fn()
      } as unknown as EventEmitter<CliStarted>
    }
  )

  describe('dag', () => {
    const cases = [
      ['3.65.0', false],
      ['3.66.0', true],
      ['3.67.1', true],
      ['4.0.0', true],
      ['unknown', false]
    ] as const
    for (const [version, supported] of cases) {
      it(`handles requested collapse with CLI version ${version}`, async () => {
        const warning = jest
          .spyOn(Toast, 'warnWithOptions')
          .mockResolvedValue(undefined)
        mockedGetProcessEnv.mockReturnValue(mockedEnv)
        mockedCreateProcess
          .mockReturnValueOnce(getMockedProcess(version))
          .mockReturnValueOnce(getMockedProcess('graph'))

        try {
          await expect(
            dvcReader.dag(__dirname, Flag.COLLAPSE_FOREACH_MATRIX)
          ).resolves.toBe('graph')
          expect(mockedCreateProcess).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ args: ['--version'] })
          )
          expect(mockedCreateProcess).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
              args: supported
                ? ['dag', '--md', Flag.COLLAPSE_FOREACH_MATRIX]
                : ['dag', '--md']
            })
          )
        } finally {
          warning.mockRestore()
        }
      })
    }

    it('should match the expected output', async () => {
      const cwd = __dirname
      const dag = `\`\`\`mermaid
      flowchart TD
              node1["nested1/data/data.xml.dvc"]
              node2["nested1/dvc.yaml:evaluate"]
              node3["nested1/dvc.yaml:featurize"]
              node4["nested1/dvc.yaml:prepare"]
              node5["nested1/dvc.yaml:train"]
              node1-->node4
              node3-->node2
              node3-->node5
              node4-->node3
              node5-->node2
              node6["nested2/data/data.xml.dvc"]
      \`\`\``
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(dag))

      const cliOutput = await dvcReader.dag(cwd)
      expect(cliOutput).toStrictEqual(dag)
      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['dag', '--md'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should return the error if the cli returns any type of error', async () => {
      const cwd = __dirname
      const error = new Error('unexpected error - something something')
      const unexpectedStderr = 'This is very unexpected'
      ;(error as MaybeConsoleError).exitCode = UNEXPECTED_ERROR_CODE
      ;(error as MaybeConsoleError).stderr = unexpectedStderr
      mockedCreateProcess.mockImplementationOnce(() => {
        throw error
      })

      const cliOutput = await dvcReader.dag(cwd)
      expect(cliOutput).toStrictEqual(
        'Error: unexpected error - something something'
      )
    })
  })

  describe('expShow', () => {
    it('should match the expected output', async () => {
      const cwd = __dirname
      mockedCreateProcess.mockReturnValueOnce(
        getMockedProcess(JSON.stringify(expShowFixture))
      )

      const cliOutput = await dvcReader.expShow(cwd)
      expect(cliOutput).toStrictEqual(expShowFixture)
      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['exp', 'show', JSON_FLAG],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should return the default output if the cli returns any type of error', async () => {
      const cwd = __dirname
      const error = new Error('unexpected error - something something')
      const unexpectedStderr = 'This is very unexpected'
      ;(error as MaybeConsoleError).exitCode = UNEXPECTED_ERROR_CODE
      ;(error as MaybeConsoleError).stderr = unexpectedStderr
      mockedCreateProcess.mockImplementationOnce(() => {
        throw error
      })

      const cliOutput = await dvcReader.expShow(cwd)
      expect(cliOutput).toStrictEqual([
        {
          error: { msg: unexpectedStderr, type: 'Caught error' },
          rev: EXPERIMENT_WORKSPACE_ID
        }
      ])
    })

    it('should return the default output if the cli returns an empty array (no commits)', async () => {
      const cwd = __dirname
      mockedCreateProcess.mockReturnValueOnce(
        getMockedProcess(JSON.stringify([]))
      )

      const cliOutput = await dvcReader.expShow(cwd)
      expect(cliOutput).toStrictEqual([{ rev: EXPERIMENT_WORKSPACE_ID }])
    })
  })

  describe('dataStatus', () => {
    it('should call the cli with the correct parameters', async () => {
      const cliOutput = {
        added: [],
        deleted: [{ path: 'data/MNIST/raw/t10k-images-idx3-ubyte' }],
        modified: [
          { path: 'data/MNIST/raw/' },
          { path: 'logs/' },
          { path: 'logs/acc.tsv' },
          { path: 'logs/loss.tsv' },
          { path: 'model.pt' },
          { path: 'predictions.json' }
        ],
        'not in cache': [],
        renamed: []
      }
      const cwd = __dirname
      mockedCreateProcess.mockReturnValueOnce(
        getMockedProcess(JSON.stringify(cliOutput))
      )
      const statusOutput = await dvcReader.dataStatus(cwd)

      expect(statusOutput).toStrictEqual(cliOutput)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['data', 'status', '--granular', '--unchanged', JSON_FLAG],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('globalVersion', () => {
    it('should call execute process with the correct parameters (does not respect pythonBinPath)', async () => {
      const cwd = __dirname
      const stdout = '3.9.11'
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))
      mockedGetPythonBinPath.mockReturnValueOnce('python')
      const output = await dvcReader.globalVersion(cwd)

      expect(output).toStrictEqual(stdout)
      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['--version'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should not retry if the process fails (cannot find cli - extension should reset)', async () => {
      const cwd = __dirname
      mockedCreateProcess.mockImplementationOnce(() => {
        throw new Error('spawn dvc ENOENT retrying...')
      })

      await expect(dvcReader.globalVersion(cwd)).rejects.toBeTruthy()
    })
  })

  describe('plotsDiff', () => {
    it('should handle empty output being returned', async () => {
      const cwd = __dirname
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(''))

      const plots = await dvcReader.plotsDiff(cwd, 'HEAD')
      expect(plots).toStrictEqual({ data: {} })
    })

    it('should remove an empty errors array from the output', async () => {
      const cwd = __dirname

      mockedCreateProcess.mockReturnValueOnce(
        getMockedProcess(JSON.stringify({ errors: [] }))
      )

      const plots = await dvcReader.plotsDiff(cwd, 'main')
      expect(plots).toStrictEqual({ data: {} })
    })

    it('should not remove an errors array with entries from the output', async () => {
      const cwd = __dirname
      const errors = [{ msg: 'something went wrong' }]

      mockedCreateProcess.mockReturnValueOnce(
        getMockedProcess(JSON.stringify({ errors }))
      )

      const plots = await dvcReader.plotsDiff(cwd, 'main')
      expect(plots).toStrictEqual({ data: {}, errors })
    })

    it('should match the expected output', async () => {
      const cwd = __dirname

      mockedCreateProcess.mockReturnValueOnce(
        getMockedProcess(JSON.stringify(plotsDiffFixture))
      )

      const plots = await dvcReader.plotsDiff(cwd, 'HEAD')
      expect(plots).toStrictEqual(plotsDiffFixture)
      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: [
          'plots',
          'diff',
          'HEAD',
          '-o',
          join(DOT_DVC, 'tmp', 'plots'),
          '--split',
          JSON_FLAG
        ],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('root', () => {
    it('should return the root relative to the cwd', async () => {
      const stdout = join('..', '..')
      const cwd = __dirname
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))
      const relativeRoot = await dvcReader.root(cwd)
      expect(relativeRoot).toStrictEqual(stdout)
      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['root'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should return undefined when run outside of a project', async () => {
      const cwd = __dirname
      mockedCreateProcess.mockReturnValueOnce(
        getFailingMockedProcess(
          "ERROR: you are not inside of a DVC repository (checked up to mount point '/' )"
        )
      )

      const relativeRoot = await dvcReader.root(cwd)
      expect(relativeRoot).toBeUndefined()
      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['root'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('version', () => {
    it('should call execute process with the correct parameters', async () => {
      const cwd = __dirname
      const stdout = '3.9.11'
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))
      const output = await dvcReader.version(cwd)

      expect(output).toStrictEqual(stdout)
      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['--version'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should respect the pythonBinPath parameters', async () => {
      const cwd = __dirname
      const stdout = '2.47.0'
      const mockedPythonPath = 'some/python/path'
      const mockedPythonBinPath = [mockedPythonPath, 'python'].join('/')
      mockedGetPythonBinPath.mockReturnValue(mockedPythonBinPath)
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))
      const output = await dvcReader.version(cwd)

      expect(output).toStrictEqual(stdout)
      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['-m', 'dvc', '--version'],
        cwd,
        env: {
          ...mockedEnv,
          PATH: joinEnvPath(mockedPythonPath, mockedEnv.PATH)
        },
        executable: mockedPythonBinPath
      })
    })

    it('should not retry if the process fails (cannot find cli - extension should reset)', async () => {
      const cwd = __dirname
      mockedCreateProcess.mockImplementationOnce(() => {
        throw new Error('spawn dvc ENOENT retrying...')
      })

      await expect(dvcReader.version(cwd)).rejects.toBeTruthy()
    })

    it('should add PYTHONPATH to the environment used to create a DVC process when it is available from the extension config', async () => {
      mockedGetPYTHONPATH.mockReturnValue(dvcDemoPath)
      const cwd = __dirname
      const stdout = '3.9.11'
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))
      const output = await dvcReader.version(cwd)

      expect(output).toStrictEqual(stdout)
      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['--version'],
        cwd,
        env: { ...mockedEnv, PYTHONPATH: dvcDemoPath },
        executable: 'dvc'
      })
    })
  })
})
