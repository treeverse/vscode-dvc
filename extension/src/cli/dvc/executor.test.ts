import { join } from 'path'
import { EventEmitter } from 'vscode'
import { Disposable, Disposer } from '@hediet/std/disposable'
import { Flag, UNEXPECTED_ERROR_CODE } from './constants'
import { DvcExecutor } from './executor'
import { CliResult, CliStarted } from '..'
import { createProcess } from '../../process/execution'
import { getMockedProcess } from '../../test/util/jest'
import { getProcessEnv } from '../../env'
import { Config } from '../../config'
import { ContextKey, setContextValue } from '../../vscode/context'
import { MaybeConsoleError } from '../error'

jest.mock('vscode')
jest.mock('@hediet/std/disposable')
jest.mock('../../process/execution')
jest.mock('../../env')
jest.mock('../../vscode/context')

const mockedDisposable = jest.mocked(Disposable)

const mockedCreateProcess = jest.mocked(createProcess)
const mockedGetProcessEnv = jest.mocked(getProcessEnv)
const mockedEnv = {
  DVCLIVE_OPEN: 'false',
  DVC_NO_ANALYTICS: 'true',
  GIT_TERMINAL_PROMPT: '0',
  PATH: '/some/special/path'
}

const mockedSetContextValue = jest.mocked(setContextValue)

beforeEach(() => {
  jest.resetAllMocks()
  mockedGetProcessEnv.mockReturnValueOnce(mockedEnv)
})

describe('CliExecutor', () => {
  mockedDisposable.fn.mockReturnValueOnce({
    track: function <T>(disposable: T): T {
      return disposable
    },
    untrack: function <T>(disposable: T): T {
      return disposable
    }
  } as unknown as (() => void) & Disposer)

  const dvcExecutor = new DvcExecutor(
    {
      getCliPath: () => undefined,
      getPYTHONPATH: () => undefined,
      getPythonBinPath: () => undefined
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

  const everythingUpToDate = 'Everything is up to date.'
  const updatingLockFile = "Updating lock file 'dvc.lock'"

  describe('add', () => {
    it('should call createProcess with the correct parameters to add a file', async () => {
      const cwd = __dirname
      const relPath = join('data', 'MNIST', 'raw')
      const stdout =
        '100% Add|████████████████████████████████████████████████' +
        '█████████████████████████████████████████████████████████' +
        '█████████████████████████████████████████████████████████' +
        '██████████████████████████████████████████|1/1 [00:00,  2' +
        '.20file/s]\n\r\n\rTo track the changes with git, run:\n\r' +
        `\n\rgit add ${relPath} .gitignore`

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.add(cwd, relPath)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['add', relPath],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should set the correct context value if the command fails', async () => {
      const cwd = __dirname
      const relPath = join('data', 'MNIST', 'raw')
      const unexpectedError = new Error(
        'unexpected error - something something'
      )
      const unexpectedStderr = 'This is very unexpected'
      ;(unexpectedError as MaybeConsoleError).exitCode = UNEXPECTED_ERROR_CODE
      ;(unexpectedError as MaybeConsoleError).stderr = unexpectedStderr
      mockedCreateProcess.mockImplementationOnce(() => {
        throw unexpectedError
      })

      let error

      try {
        await dvcExecutor.add(cwd, relPath)
      } catch (thrownError) {
        error = thrownError
      }

      expect((error as MaybeConsoleError).stderr).toStrictEqual(
        unexpectedStderr
      )

      expect(mockedSetContextValue).toHaveBeenLastCalledWith(
        ContextKey.SCM_RUNNING,
        false
      )
    })
  })

  describe('checkout', () => {
    it('should call createProcess with the correct parameters to checkout a repository', async () => {
      const fsPath = __dirname
      const stdout = 'M       model.pt\nM       logs/\n'
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.checkout(fsPath)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['checkout'],
        cwd: fsPath,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should call createProcess with the correct parameters to force checkout a repository', async () => {
      const fsPath = __dirname
      const stdout = 'M       model.pt\nM       logs/\n'
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.checkout(fsPath, Flag.FORCE)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['checkout', '-f'],
        cwd: fsPath,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should call createProcess with the correct parameters to checkout a file', async () => {
      const cwd = __dirname
      const relPath = join('logs', 'acc.tsv')

      const stdout = 'M       ./'

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.checkout(cwd, relPath)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['checkout', relPath],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should call createProcess with the correct parameters to force checkout a file', async () => {
      const cwd = __dirname
      const relPath = join('logs', 'acc.tsv')

      const stdout = 'M       ./'

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.checkout(cwd, relPath, Flag.FORCE)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['checkout', relPath, '-f'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('commit', () => {
    it('should call createProcess with the correct parameters to force commit a repository (by default)', async () => {
      const cwd = __dirname
      const stdout = updatingLockFile
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.commit(cwd)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['commit', '-f'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should call createProcess with the correct parameters to commit a target (force by default)', async () => {
      const cwd = __dirname
      const relPath = join(
        'data',
        'fashion-mnist',
        'raw',
        't10k-images-idx3-ubyte.gz'
      )
      const stdout = updatingLockFile
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.commit(cwd, relPath)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['commit', relPath, '-f'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('expApply', () => {
    it('should call createProcess with the correct parameters to apply an existing experiment to the workspace', async () => {
      const cwd = ''
      const stdout = 'Test output that will be passed along'
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.expApply(cwd, 'exp-test')
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['exp', 'apply', 'exp-test'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('expBranch', () => {
    it('should call createProcess with the correct parameters to create a new branch from an existing experiment', async () => {
      const cwd = __dirname
      const stdout =
        "Git branch 'some-branch' has been created from experiment 'exp-0898f'.\n" +
        'To switch to the new branch run:\n\n' +
        '\t\tgit checkout some-branch'
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.expBranch(
        cwd,
        'exp-0898f',
        'some-branch'
      )
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['exp', 'branch', 'exp-0898f', 'some-branch'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('expPush', () => {
    it('should call createProcess with the correct parameters to push an existing experiment to the remote', async () => {
      const cwd = __dirname
      const stdout = ''
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.expPush(cwd, 'toric-sail')
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['exp', 'push', 'origin', 'toric-sail'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should call createProcess with the correct parameters to push multiple experiments to the remote', async () => {
      const cwd = __dirname
      const stdout = ''
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))
      const mockExperimentIds = ['toric-sail', 'couth-bean', 'arced-ibex']

      const output = await dvcExecutor.expPush(cwd, ...mockExperimentIds)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['exp', 'push', 'origin', ...mockExperimentIds],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('expRemove', () => {
    it('should call createProcess with the correct parameters to remove an existing experiment from the workspace', async () => {
      const cwd = __dirname
      const stdout = ''
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.expRemove(cwd, 'exp-dfd12')
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['exp', 'remove', 'exp-dfd12'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('expRemoveQueue', () => {
    it('should call createProcess with the correct parameters to remove all existing queued experiments from the workspace', async () => {
      const cwd = __dirname
      const stdout = ''
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.expRemoveQueue(cwd)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['exp', 'remove', '--queue'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('expRunQueue', () => {
    it('should call createProcess with the correct parameters to queue an experiment for later execution', async () => {
      const cwd = __dirname
      const stdout = "Queued experiment 'bbf5c01' for future execution."
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.expRunQueue(cwd)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['exp', 'run', '--queue'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('init', () => {
    it('should call createProcess with the correct parameters to initialize a project', async () => {
      const fsPath = __dirname
      const stdout = `
		Initialized DVC repository.
		You can now commit the changes to git.
		
		+---------------------------------------------------------------------+
		|                                                                     |
		|        DVC has enabled anonymous aggregate usage analytics.         |
		|     Read the analytics documentation (and how to opt-out) here:     |
		|             <https://dvc.org/doc/user-guide/analytics>              |
		|                                                                     |
		+---------------------------------------------------------------------+
		
		What's next?
		------------
		- Check out the documentation: <https://dvc.org/doc>
		- Get help and share ideas: <https://dvc.org/chat>
		- Star us on GitHub: <https://github.com/treeverse/dvc>`

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.init(fsPath)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['init', '--subdir'],
        cwd: fsPath,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('pull', () => {
    it('should call createProcess with the correct parameters to pull the entire repository', async () => {
      const cwd = __dirname
      const stdout = 'M       data/MNIST/raw/\n1 file modified'

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.pull(cwd)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['pull'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should call createProcess with the correct parameters to force pull the entire repository', async () => {
      const cwd = __dirname
      const stdout = 'M       data/MNIST/raw/\n1 file modified'

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.pull(cwd, Flag.FORCE)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['pull', '-f'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should call createProcess with the correct parameters to pull the target', async () => {
      const cwd = __dirname
      const relPath = join('data', 'MNIST', 'raw', 'train-images-idx3-ubyte')
      const stdout = 'M       logs/\n1 file modified'

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.pull(cwd, relPath)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['pull', relPath],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should call createProcess with the correct parameters to force pull a target', async () => {
      const cwd = __dirname
      const stdout = everythingUpToDate
      const relPath = join('logs', 'acc.tsv')

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.pull(cwd, relPath, Flag.FORCE)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['pull', relPath, '-f'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('push', () => {
    it('should call createProcess with the correct parameters to push the entire repository', async () => {
      const cwd = __dirname
      const stdout = everythingUpToDate

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.push(cwd)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['push'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should call createProcess with the correct parameters to force push the entire repository', async () => {
      const cwd = __dirname
      const stdout = everythingUpToDate
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.push(cwd, Flag.FORCE)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['push', '-f'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should call createProcess with the correct parameters to push the target', async () => {
      const cwd = __dirname
      const relPath = join('data', 'MNIST')
      const stdout = everythingUpToDate

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.push(cwd, relPath)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['push', relPath],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should call createProcess with the correct parameters to force push a target', async () => {
      const cwd = __dirname
      const stdout = everythingUpToDate
      const relPath = join('logs', 'loss.tsv')

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.push(cwd, relPath, Flag.FORCE)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['push', relPath, '-f'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('queueKill', () => {
    it('should call createProcess with the correct parameters to kill running queue tasks', async () => {
      const cwd = __dirname
      const stdout = ''

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.queueKill(cwd, '80609f0', '19d1c56')

      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['queue', 'kill', '80609f0', '19d1c56'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('queueStart', () => {
    it("should call createProcess with the correct parameters to start the experiment's queue in a detached process", () => {
      const cwd = __dirname
      const jobs = '91231324'

      const stdout = `Started '${jobs}' new experiments task queue workers.`

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      void dvcExecutor.queueStart(cwd, jobs)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['queue', 'start', '-j', jobs],
        cwd,
        detached: true,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('queueStop', () => {
    it("should call createProcess with the correct parameters to stop the experiment's queue", async () => {
      const cwd = __dirname

      const stdout = 'Queue workers will stop after running tasks finish.'

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.queueStop(cwd)

      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['queue', 'stop'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('remove', () => {
    it('should call createProcess with the correct parameters to remove a .dvc file', async () => {
      const cwd = __dirname
      const relPath = 'data.dvc'

      const stdout = ''

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.remove(cwd, relPath)
      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['remove', relPath],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })

      expect(mockedSetContextValue).toHaveBeenCalledTimes(2)
      expect(mockedSetContextValue).toHaveBeenCalledWith(
        ContextKey.SCM_RUNNING,
        true
      )
      expect(mockedSetContextValue).toHaveBeenLastCalledWith(
        ContextKey.SCM_RUNNING,
        false
      )
    })
  })

  describe('rename', () => {
    it('should call createProcess with the correct parameters to rename the experiment', async () => {
      const cwd = __dirname

      const stdout = 'Experiment renamed successfully.'

      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))

      const output = await dvcExecutor.expRename(cwd, 'old-name', 'new-name')

      expect(output).toStrictEqual(stdout)

      expect(mockedCreateProcess).toHaveBeenCalledWith({
        args: ['exp', 'rename', 'old-name', 'new-name'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })
})
