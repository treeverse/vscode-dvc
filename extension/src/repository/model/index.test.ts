import { join } from 'path'
import { Uri } from 'vscode'
import { Disposable, Disposer } from '@hediet/std/disposable'
import { RepositoryModel } from '.'
import { dvcDemoPath } from '../../test/util'
import { SourceControlDataStatus } from '../sourceControlManagement'
import { makeAbsPathSet } from '../../test/util/path'

jest.mock('vscode')
jest.mock('@hediet/std/disposable')

const mockedDisposable = jest.mocked(Disposable)

beforeEach(() => {
  jest.resetAllMocks()

  mockedDisposable.fn.mockReturnValue({
    track: function <T>(disposable: T): T {
      return disposable
    }
  } as unknown as (() => void) & Disposer)
})

describe('RepositoryModel', () => {
  const emptySet = new Set()

  describe('transformAndSet', () => {
    const deleted = join('data', 'MNIST', 'raw', 'train-labels-idx1-ubyte')
    const logDir = 'logs'
    const scalarDir = join(logDir, 'scalar')
    const logAcc = join(scalarDir, 'acc.tsv')
    const logLoss = join(scalarDir, 'loss.tsv')
    const output = 'model.pt'
    const predictions = 'predictions.json'
    const rawDataDir = join('data', 'MNIST', 'raw')
    const renamed = join('data', 'MNIST', 'raw', 'train-lulbels-idx9-ubyte')
    const notInCacheDeleted = join(
      'data',
      'MNIST',
      'raw',
      'train-labels-idx9-ubyte'
    )

    it('should correctly process the output of data status', () => {
      const dataStatus = {
        committed: {
          deleted: [deleted],
          modified: [output],
          renamed: [{ new: renamed, old: 'does not matter' }]
        },
        not_in_cache: [],
        unchanged: [predictions],
        uncommitted: {
          modified: [rawDataDir, logDir, scalarDir, logAcc, logLoss]
        },
        untracked: []
      }

      const model = new RepositoryModel(dvcDemoPath)
      const { scmDecorationState, sourceControlManagementState } =
        model.transformAndSetCli({
          dataStatus,
          untracked: new Set()
        })

      expect(scmDecorationState.committedAdded).toStrictEqual(new Set())
      expect(scmDecorationState.committedDeleted).toStrictEqual(
        makeAbsPathSet(dvcDemoPath, deleted)
      )
      expect(scmDecorationState.committedModified).toStrictEqual(
        makeAbsPathSet(dvcDemoPath, output)
      )
      expect(scmDecorationState.committedRenamed).toStrictEqual(
        makeAbsPathSet(dvcDemoPath, renamed)
      )
      expect(scmDecorationState.committedUnknown).toStrictEqual(new Set())
      expect(scmDecorationState.notInCache).toStrictEqual(new Set())
      expect(scmDecorationState.tracked).toStrictEqual(
        makeAbsPathSet(
          dvcDemoPath,
          predictions,
          deleted,
          output,
          renamed,
          rawDataDir,
          logDir,
          scalarDir,
          logAcc,
          logLoss
        )
      )
      expect(scmDecorationState.uncommittedAdded).toStrictEqual(new Set())
      expect(scmDecorationState.uncommittedDeleted).toStrictEqual(new Set())
      expect(scmDecorationState.uncommittedModified).toStrictEqual(
        makeAbsPathSet(
          dvcDemoPath,
          rawDataDir,
          logDir,
          scalarDir,
          logAcc,
          logLoss
        )
      )
      expect(scmDecorationState.uncommittedRenamed).toStrictEqual(new Set())
      expect(scmDecorationState.uncommittedUnknown).toStrictEqual(new Set())

      expect(sourceControlManagementState).toStrictEqual({
        committed: [
          {
            contextValue: SourceControlDataStatus.COMMITTED_DELETED,
            dvcRoot: dvcDemoPath,
            isDirectory: false,
            isTracked: true,
            resourceUri: Uri.file(join(dvcDemoPath, deleted))
          },
          {
            contextValue: SourceControlDataStatus.COMMITTED_MODIFIED,
            dvcRoot: dvcDemoPath,
            isDirectory: false,
            isTracked: true,
            resourceUri: Uri.file(join(dvcDemoPath, output))
          },
          {
            contextValue: SourceControlDataStatus.COMMITTED_RENAMED,
            dvcRoot: dvcDemoPath,
            isDirectory: false,
            isTracked: true,
            resourceUri: Uri.file(join(dvcDemoPath, renamed))
          }
        ],
        notInCache: [],
        uncommitted: [rawDataDir, logDir, scalarDir, logAcc, logLoss].map(
          path => ({
            contextValue: SourceControlDataStatus.UNCOMMITTED_MODIFIED,
            dvcRoot: dvcDemoPath,
            isDirectory: [rawDataDir, logDir, scalarDir].includes(path),
            isTracked: true,
            resourceUri: Uri.file(join(dvcDemoPath, path))
          })
        ),
        untracked: []
      })
    })

    it('should set the context value of resources that are both uncommitted and not in cache to notInCache', () => {
      const notInCache = [
        rawDataDir,
        logDir,
        scalarDir,
        logAcc,
        logLoss,
        notInCacheDeleted
      ]

      const dataStatus = {
        not_in_cache: notInCache,
        uncommitted: {
          deleted: notInCache
        }
      }

      const model = new RepositoryModel(dvcDemoPath)
      const { scmDecorationState, sourceControlManagementState } =
        model.transformAndSetCli({
          dataStatus,
          untracked: new Set()
        })

      const absNotInCache = makeAbsPathSet(dvcDemoPath, ...notInCache)

      for (const [key, value] of Object.entries(scmDecorationState)) {
        if (!(key in ['notInCache', 'tracked', 'notInCache'])) {
          continue
        }
        expect(value).toStrictEqual(emptySet)
      }

      expect(scmDecorationState.tracked).toStrictEqual(absNotInCache)
      expect(scmDecorationState.notInCache).toStrictEqual(absNotInCache)
      expect(scmDecorationState.uncommittedDeleted).toStrictEqual(absNotInCache)

      const notInCacheScm = notInCache.map(path => ({
        contextValue: SourceControlDataStatus.NOT_IN_CACHE,
        dvcRoot: dvcDemoPath,
        isDirectory: [rawDataDir, logDir, scalarDir].includes(path),
        isTracked: true,
        resourceUri: Uri.file(join(dvcDemoPath, path))
      }))

      expect(sourceControlManagementState).toStrictEqual({
        committed: [],
        notInCache: notInCacheScm,
        uncommitted: notInCacheScm,
        untracked: []
      })
    })

    it('should handle data status output which only has unchanged paths', () => {
      const rawDataDir = join('data', 'MNIST', 'raw')
      const data = join(rawDataDir, 'train-labels-idx2-ubyte')

      const dataStatus = {
        unchanged: [rawDataDir, data]
      }

      const model = new RepositoryModel(dvcDemoPath)
      const { scmDecorationState, sourceControlManagementState } =
        model.transformAndSetCli({
          dataStatus,
          untracked: new Set()
        })

      for (const [key, value] of Object.entries(scmDecorationState)) {
        if (key === 'tracked') {
          continue
        }
        expect(value).toStrictEqual(emptySet)
      }
      expect(scmDecorationState.tracked).toStrictEqual(
        makeAbsPathSet(dvcDemoPath, rawDataDir, data)
      )

      expect(sourceControlManagementState).toStrictEqual({
        committed: [],
        notInCache: [],
        uncommitted: [],
        untracked: []
      })
    })

    it('should clear an error when there is no data in the tree and the error is fixed', () => {
      const emptyRepoData = {
        dataStatus: {},
        hasGitChanges: true,
        untracked: new Set<string>()
      }

      const msg = "'./dvc.yaml' validation failed.\n\nwith some other text"

      const error = {
        msg,
        type: 'caught error'
      }

      const emptyRepoError = { ...emptyRepoData, dataStatus: { error } }
      const model = new RepositoryModel(dvcDemoPath)

      model.transformAndSetCli(emptyRepoData)
      expect(model.getChildren(dvcDemoPath)).toStrictEqual([])

      model.transformAndSetCli(emptyRepoError)
      expect(model.getChildren(dvcDemoPath)).toStrictEqual([{ error: msg }])

      model.transformAndSetCli(emptyRepoData)
      expect(model.getChildren(dvcDemoPath)).toStrictEqual([])
    })
  })
})
