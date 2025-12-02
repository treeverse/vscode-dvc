import { spy, stub } from 'sinon'
import { EventEmitter } from 'vscode'
import * as Fetch from 'node-fetch'
import { WorkspaceExperiments } from '../../../experiments/workspace'
import { Experiments } from '../../../experiments'
import { Disposer } from '../../../extension'
import expShowFixture from '../../fixtures/expShow/base/output'
import gitLogFixture from '../../fixtures/expShow/base/gitLog'
import rowOrderFixture from '../../fixtures/expShow/base/rowOrder'
import remoteExpRefsFixture from '../../fixtures/expShow/base/remoteExpRefs'
import { buildMockMemento, dvcDemoPath } from '../../util'
import {
  buildDependencies,
  buildInternalCommands,
  buildMockExperimentsData,
  getMessageReceivedEmitter,
  SafeWatcherDisposer
} from '../util'
import { ExperimentsData } from '../../../experiments/data'
import * as Watcher from '../../../fileSystem/watcher'
import { ExperimentsModel } from '../../../experiments/model'
import { ColumnsModel } from '../../../experiments/columns/model'
import { DEFAULT_CURRENT_BRANCH_COMMITS_TO_SHOW } from '../../../cli/dvc/constants'
import { PersistenceKey } from '../../../persistence/constants'
import { ExpShowOutput } from '../../../cli/dvc/contract'
import { buildExperimentsPipeline } from '../pipeline/util'
import { Setup } from '../../../setup'
import { Studio } from '../../../experiments/studio'
import { DEFAULT_STUDIO_URL } from '../../../setup/webview/contract'

export const DEFAULT_EXPERIMENTS_OUTPUT = {
  availableNbCommits: { main: 5 },
  expShow: expShowFixture,
  gitLog: gitLogFixture,
  rowOrder: rowOrderFixture
}

export const mockBaseStudioUrl =
  'https://studio.datachain.ai/user/olivaw/projects/vscode-dvc-demo-ynm6t3jxdx'

export const buildExperiments = ({
  availableNbCommits = { main: 5 },
  viewUrl = mockBaseStudioUrl,
  disposer,
  dvcRoot = dvcDemoPath,
  expShow = expShowFixture,
  gitLog = gitLogFixture,
  live = [],
  lsRemoteOutput = remoteExpRefsFixture,
  pushed = ['42b8736b08170529903cd203a1f40382a4b4a8cd'],
  rowOrder = rowOrderFixture,
  stageList = 'train'
}: {
  availableNbCommits?: { [branch: string]: number }
  disposer: Disposer
  viewUrl?: string
  dvcRoot?: string
  expShow?: ExpShowOutput
  gitLog?: string
  live?: { baselineSha: string; name: string }[]
  lsRemoteOutput?: string
  pushed?: string[]
  rowOrder?: { branch: string; sha: string }[]
  stageList?: string | null
}) => {
  const {
    dvcExecutor,
    dvcReader,
    dvcRunner,
    dvcViewer,
    gitReader,
    internalCommands,
    mockCheckSignalFile,
    mockExpShow,
    mockGetCommitMessages,
    resourceLocator
  } = buildDependencies({ disposer, expShow, stageList })

  const mockUpdateExperimentsData = stub()
  const mockExperimentsData = buildMockExperimentsData(
    mockUpdateExperimentsData
  )

  const pipeline = buildExperimentsPipeline({
    disposer,
    dvcRoot,
    internalCommands
  })
  const mockCheckOrAddPipeline = stub(pipeline, 'checkOrAddPipeline')
  const mockAddPipeline = stub(pipeline, 'addPipeline')
  const mockSelectBranches = stub().resolves(['main', 'other'])
  const mockMemento = buildMockMemento({
    [`${PersistenceKey.EXPERIMENTS_BRANCHES}${dvcRoot}`]: ['main'],
    [`${PersistenceKey.NUMBER_OF_COMMITS_TO_SHOW}${dvcRoot}`]: {
      main: 5
    }
  })

  const experiments = disposer.track(
    new Experiments(
      dvcRoot,
      internalCommands,
      pipeline,
      resourceLocator,
      mockMemento,
      mockSelectBranches,
      [],
      mockExperimentsData
    )
  )

  void Promise.all([
    experiments.setState({
      availableNbCommits,
      expShow,
      gitLog,
      rowOrder
    }),
    experiments.setState({ lsRemoteOutput }),
    experiments.setState({ live, pushed, viewUrl })
  ])

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,
    columnsModel: (experiments as any).columns as ColumnsModel,
    dvcExecutor,
    dvcReader,
    dvcRunner,
    dvcViewer,
    experiments,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    experimentsModel: (experiments as any).experiments as ExperimentsModel,
    gitReader,
    internalCommands,
    mockAddPipeline,
    mockCheckOrAddPipeline,
    mockCheckSignalFile,
    mockExpShow,
    mockExperimentsData,
    mockGetCommitMessages,
    mockSelectBranches,
    mockUpdateExperimentsData,
    pipeline,
    resourceLocator
  }
}

const buildMockSetup = (disposer: Disposer): Setup => {
  const studioConnectionChanged = disposer.track(new EventEmitter())
  return {
    getStudioAccessToken: () => Promise.resolve(undefined),
    getStudioUrl: () => DEFAULT_STUDIO_URL,
    onDidChangeStudioConnection: studioConnectionChanged.event
  } as unknown as Setup
}

export const buildExperimentsWebview = async (inputs: {
  availableNbCommits?: { [branch: string]: number }
  disposer: Disposer
  dvcRoot?: string
  expShow?: ExpShowOutput
  gitLog?: string
  lsRemoteOutput?: string
  rowOrder?: { branch: string; sha: string }[]
  stageList?: string | null
}) => {
  const all = buildExperiments(inputs)
  const { experiments } = all
  await experiments.isReady()
  const webview = await experiments.showWebview()
  await webview.isReady()
  const messageSpy = spy(webview, 'show')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (experiments as any).webviewMessages.sendWebviewMessage()

  const mockMessageReceived = getMessageReceivedEmitter(webview)

  return {
    ...all,
    messageSpy,
    mockMessageReceived,
    webview
  }
}

export const buildMultiRepoExperiments = (disposer: SafeWatcherDisposer) => {
  const {
    experiments: mockExperiments,
    gitReader,
    internalCommands,
    resourceLocator
  } = buildExperiments({
    disposer,
    dvcRoot: 'other/dvc/root',
    expShow: expShowFixture
  })

  stub(gitReader, 'getGitRepositoryRoot').resolves(dvcDemoPath)
  const workspaceExperiments = disposer.track(
    new WorkspaceExperiments(internalCommands, buildMockMemento(), {
      'other/dvc/root': mockExperiments
    })
  )

  const pipeline = buildExperimentsPipeline({
    disposer,
    dvcRoot: dvcDemoPath,
    internalCommands
  })
  stub(pipeline, 'hasPipeline').returns(true)

  const [experiments] = workspaceExperiments.create(
    [dvcDemoPath],
    { [dvcDemoPath]: [] },
    { getRepository: () => pipeline },
    buildMockSetup(disposer),
    resourceLocator
  )

  void experiments.setState(DEFAULT_EXPERIMENTS_OUTPUT)
  return { experiments, internalCommands, workspaceExperiments }
}

export const buildSingleRepoExperiments = (disposer: SafeWatcherDisposer) => {
  const { config, internalCommands, gitReader, resourceLocator } =
    buildDependencies({ disposer })

  stub(gitReader, 'getGitRepositoryRoot').resolves(dvcDemoPath)
  const workspaceExperiments = disposer.track(
    new WorkspaceExperiments(internalCommands, buildMockMemento())
  )

  const pipeline = buildExperimentsPipeline({
    disposer,
    dvcRoot: dvcDemoPath,
    internalCommands
  })

  const [experiments] = workspaceExperiments.create(
    [dvcDemoPath],
    { [dvcDemoPath]: [] },
    { getRepository: () => pipeline },
    buildMockSetup(disposer),
    resourceLocator
  )

  void experiments.setState(DEFAULT_EXPERIMENTS_OUTPUT)

  return {
    config,
    internalCommands,
    resourceLocator,
    workspaceExperiments
  }
}

const buildExperimentsDataDependencies = (disposer: Disposer) => {
  const mockCreateFileSystemWatcher = stub(
    Watcher,
    'createFileSystemWatcher'
  ).returns(undefined)

  const { dvcReader, gitReader, internalCommands } =
    buildInternalCommands(disposer)
  const mockExpShow = stub(dvcReader, 'expShow').resolves(expShowFixture)
  return {
    gitReader,
    internalCommands,
    mockCreateFileSystemWatcher,
    mockExpShow
  }
}

export const buildExperimentsData = (
  disposer: SafeWatcherDisposer,
  currentBranch = '* main',
  commitOutput = gitLogFixture,
  studioAccessToken = '',
  studioUrl = DEFAULT_STUDIO_URL
) => {
  const {
    internalCommands,
    mockExpShow,
    mockCreateFileSystemWatcher,
    gitReader
  } = buildExperimentsDataDependencies(disposer)

  stub(gitReader, 'getBranches').resolves([currentBranch, 'one'])
  stub(gitReader, 'getRemoteExperimentRefs').resolves('')
  const mockGetCommitMessages = stub(gitReader, 'getCommitMessages').resolves(
    commitOutput
  )
  const mockGetNumCommits = stub(gitReader, 'getNumCommits').resolves(404)
  const mockFetch = stub(Fetch, 'default').resolves({
    json: () =>
      Promise.resolve({
        live: [],
        pushed: [],
        view_url: mockBaseStudioUrl
      })
  } as Fetch.Response)

  const mockGetBranchesToShow = stub().returns(['main'])
  const mockSetBranches = stub()
  const data = disposer.track(
    new ExperimentsData(
      dvcDemoPath,
      internalCommands,
      {
        getBranchesToShow: mockGetBranchesToShow,
        getNbOfCommitsToShow: () => DEFAULT_CURRENT_BRANCH_COMMITS_TO_SHOW,
        setBranches: mockSetBranches
      } as unknown as ExperimentsModel,
      {
        getAccessToken: () => studioAccessToken,
        getGitRemoteUrl: () => 'git@github.com:treeverse/vscode-dvc-demo.git',
        getInstanceUrl: () => studioUrl,
        isReady: () => Promise.resolve(undefined)
      } as Studio,
      []
    )
  )

  return {
    data,
    mockCreateFileSystemWatcher,
    mockExpShow,
    mockFetch,
    mockGetBranchesToShow,
    mockGetCommitMessages,
    mockGetNumCommits,
    mockSetBranches
  }
}

const stubWorkspaceExperiments = (
  dvcRoot: string,
  experiments: Experiments
) => {
  const mockGetOnlyOrPickProject = stub(
    WorkspaceExperiments.prototype,
    'getOnlyOrPickProject'
  ).resolves(dvcRoot)

  const mockGetRepository = stub(
    WorkspaceExperiments.prototype,
    'getRepository'
  ).returns(experiments)

  return { mockGetOnlyOrPickProject, mockGetRepository }
}

export const stubWorkspaceGetters = async (
  disposer: Disposer,
  dvcRoot = dvcDemoPath
) => {
  const {
    columnsModel,
    dvcExecutor,
    dvcRunner,
    experiments,
    experimentsModel
  } = buildExperiments({ disposer })

  await experiments.isReady()

  stub(Setup.prototype, 'shouldBeShown').returns({
    dvc: true,
    experiments: true
  })

  return {
    columnsModel,
    dvcExecutor,
    dvcRunner,
    experiments,
    experimentsModel,
    ...stubWorkspaceExperiments(dvcRoot, experiments)
  }
}

export const stubWorkspaceGettersWebview = async (
  disposer: Disposer,
  dvcRoot = dvcDemoPath
) => {
  const {
    columnsModel,
    dvcExecutor,
    dvcRunner,
    experiments,
    experimentsModel,
    messageSpy,
    mockMessageReceived,
    webview,
    mockUpdateExperimentsData
  } = await buildExperimentsWebview({ disposer })

  return {
    columnsModel,
    dvcExecutor,
    dvcRunner,
    experiments,
    experimentsModel,
    messageSpy,
    ...stubWorkspaceExperiments(dvcRoot, experiments),
    mockMessageReceived,
    mockUpdateExperimentsData,
    webview
  }
}
