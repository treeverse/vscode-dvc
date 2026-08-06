/* eslint-disable @typescript-eslint/no-explicit-any */
import { resolve } from 'path'
import { SinonSpy, SinonStub, spy, stub } from 'sinon'
import {
  commands,
  ConfigurationChangeEvent,
  EventEmitter,
  QuickPick,
  TextEditor,
  Uri,
  window,
  workspace
} from 'vscode'
import { DvcReader } from '../../cli/dvc/reader'
import { DvcRunner } from '../../cli/dvc/runner'
import { InternalCommands } from '../../commands/internal'
import { Config } from '../../config'
import { Experiments } from '../../experiments'
import { Disposable, Disposer } from '../../extension'
import { definedAndNonEmpty } from '../../util/array'
import * as Time from '../../util/time'
import { OutputChannel } from '../../vscode/outputChannel'
import expShowFixture from '../fixtures/expShow/base/output'
import plotsDiffFixture from '../fixtures/plotsDiff/output'
import { BaseWebview } from '../../webview'
import { ExperimentsData } from '../../experiments/data'
import { ResourceLocator } from '../../resourceLocator'
import { DEFAULT_DEBOUNCE_WINDOW_MS } from '../../process/manager'
import * as FileSystem from '../../fileSystem'
import * as Watcher from '../../fileSystem/watcher'
import { MessageFromWebview } from '../../webview/contract'
import { PlotsData } from '../../plots/webview/contract'
import { TableData } from '../../experiments/webview/contract'
import { DvcExecutor } from '../../cli/dvc/executor'
import { GitReader } from '../../cli/git/reader'
import { SetupData } from '../../setup/webview/contract'
import { DvcViewer } from '../../cli/dvc/viewer'
import { Toast } from '../../vscode/toast'
import { GitExecutor } from '../../cli/git/executor'
import { DvcConfig } from '../../cli/dvc/config'
import { ExpShowOutput, PlotsOutput } from '../../cli/dvc/contract'
import { QuickPickItemWithValue } from '../../vscode/quickPick'

export const mockDisposable = {
  dispose: stub()
} as Disposable

const extensionUri = Uri.file(resolve(__dirname, '..', '..', '..'))

export const configurationChangeEvent = (
  option: string,
  disposable: Disposer
) =>
  new Promise(resolve => {
    const listener: Disposable = workspace.onDidChangeConfiguration(
      (event: ConfigurationChangeEvent) => {
        if (event.affectsConfiguration(option)) {
          resolve(event)
        }
      }
    )
    disposable.track(listener)
  })

export const quickPickInitialized = (
  mockShowQuickPick: SinonStub,
  call: number
) =>
  new Promise(resolve => {
    mockShowQuickPick.onCall(call).callsFake((items, options) =>
      mockShowQuickPick.wrappedMethod(items, {
        ...options,
        onDidSelectItem: (item: unknown) => {
          resolve(item)
          if (options?.onDidSelectItem) {
            options.onDidSelectItem(item)
          }
        }
      })
    )
  })

export const selectQuickPickItem = async (number: number) => {
  for (let i = 1; i < number; i++) {
    await commands.executeCommand('workbench.action.quickOpenSelectNext')
  }
  return commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem')
}

type NumberQuickPick = QuickPick<QuickPickItemWithValue<number>>

const getQuickPickSelectionEvent = (
  quickPick: NumberQuickPick,
  numberInd: number
) =>
  new Promise(resolve =>
    quickPick.onDidChangeSelection(items => {
      const isItemSelected = items[numberInd]
      if (isItemSelected) {
        resolve(undefined)
      }
    })
  )

const itemsSelected = (
  quickPick: NumberQuickPick,
  expectedSelectedCount: number
) =>
  new Promise(resolve => {
    if (quickPick.selectedItems.length === expectedSelectedCount) {
      resolve(undefined)
    }
  })

const toggleQuickPickItem = async (
  number: number,
  numberInd: number,
  itemsLength: number,
  quickPick: NumberQuickPick
) => {
  for (let itemInd = 1; itemInd <= itemsLength + 1; itemInd++) {
    await commands.executeCommand('workbench.action.quickOpenNavigateNext')
    if (itemInd === number) {
      const selectionEvent = getQuickPickSelectionEvent(quickPick, numberInd)
      await commands.executeCommand('workbench.action.quickPickManyToggle')
      await Promise.all([
        selectionEvent,
        itemsSelected(quickPick, numberInd + 1)
      ])
    }
  }
}

export const selectMultipleQuickPickItems = async (
  numbers: number[],
  itemsLength: number,
  quickPick: NumberQuickPick,
  acceptItems = true
) => {
  for (const [ind, num] of numbers.entries()) {
    await toggleQuickPickItem(num, ind, itemsLength, quickPick)
  }
  if (acceptItems) {
    return commands.executeCommand(
      'workbench.action.acceptSelectedQuickOpenItem'
    )
  }
}

export const experimentsUpdatedEvent = (experiments: Experiments) =>
  new Promise(resolve => {
    experiments.dispose.track(experiments.onDidChangeExperiments(resolve))
  })

const getFirstArgOfCall = (spy: SinonSpy, call: number) =>
  spy.getCall(call).firstArg

export const getArgOfCall = (spy: SinonSpy, call: number, arg: number) =>
  spy.getCall(call).args[arg - 1]

export const getFirstArgOfLastCall = (spy: SinonSpy) =>
  getFirstArgOfCall(spy, -1)

export const activeTextEditorChangedEvent = (
  disposable: Disposer
): Promise<TextEditor | undefined> =>
  new Promise(resolve =>
    disposable.track(
      window.onDidChangeActiveTextEditor(editor => resolve(editor))
    )
  )

export const getActiveTextEditorFilename = (): string | undefined =>
  window.activeTextEditor?.document.fileName

export const closeAllEditors = async () => {
  if (definedAndNonEmpty(window.visibleTextEditors)) {
    await commands.executeCommand('workbench.action.closeAllEditors')
  }
}

export const closeAllTerminals = () =>
  commands.executeCommand('workbench.action.terminal.killAll')

export const mockDuration = (duration: number) =>
  stub(Time, 'getCurrentEpoch')
    .onFirstCall()
    .returns(0)
    .onSecondCall()
    .returns(duration)

export const FIRST_TRUTHY_TIME = 1

export const getMockNow = () =>
  stub(Time, 'getCurrentEpoch').returns(FIRST_TRUTHY_TIME)

export const bypassProcessManagerDebounce = (
  mockNow: SinonStub<[], number>,
  call = 1
) => {
  mockNow.resetBehavior()
  mockNow.returns(DEFAULT_DEBOUNCE_WINDOW_MS * call + FIRST_TRUTHY_TIME)
}

export const buildInternalCommands = (disposer: Disposer) => {
  const config = disposer.track(new Config())
  const dvcConfig = disposer.track(new DvcConfig(config))
  const dvcReader = disposer.track(new DvcReader(config))
  const dvcRunner = disposer.track(new DvcRunner(config))
  const dvcExecutor = disposer.track(new DvcExecutor(config))
  const dvcViewer = disposer.track(new DvcViewer(config))
  const gitReader = disposer.track(new GitReader())
  const gitExecutor = disposer.track(new GitExecutor())

  // not tracked due to https://github.com/microsoft/vscode/issues/232559
  const outputChannel = new OutputChannel([dvcReader], '1', 'test output')

  const internalCommands = disposer.track(
    new InternalCommands(
      outputChannel,
      dvcConfig,
      dvcExecutor,
      dvcReader,
      dvcRunner,
      dvcViewer,
      gitExecutor,
      gitReader
    )
  )

  return {
    config,
    dvcConfig,
    dvcExecutor,
    dvcReader,
    dvcRunner,
    dvcViewer,
    gitExecutor,
    gitReader,
    internalCommands
  }
}

export const buildMockExperimentsData = (update = stub()) =>
  ({
    dispose: stub(),
    dvcYamlChanged: stub(),
    getBranchesToShow: () => ['main'],
    isReady: stub(),
    onDidChangeDvcYaml: stub(),
    onDidUpdate: stub(),
    setBranches: stub(),
    update
  }) as unknown as ExperimentsData

const buildResourceLocator = (disposer: Disposer): ResourceLocator =>
  disposer.track(new ResourceLocator(extensionUri))

export const buildDependencies = ({
  dag = '',
  disposer,
  expShow = expShowFixture,
  plotsDiff = plotsDiffFixture,
  stageList = 'train'
}: {
  dag?: string | undefined
  disposer: Disposer
  expShow?: ExpShowOutput
  stageList?: string | null
  plotsDiff?: PlotsOutput
}) => {
  const {
    config,
    dvcConfig,
    dvcExecutor,
    dvcReader,
    dvcRunner,
    dvcViewer,
    gitExecutor,
    gitReader,
    internalCommands
  } = buildInternalCommands(disposer)

  const mockCreateFileSystemWatcher = stub(
    Watcher,
    'createFileSystemWatcher'
  ).returns(undefined)

  const mockCheckSignalFile = stub(FileSystem, 'checkSignalFile').resolves(
    false
  )

  const mockDataStatus = stub(dvcReader, 'dataStatus').resolves({})

  const mockPlotsDiff = stub(dvcReader, 'plotsDiff').resolves(plotsDiff)

  const mockExpShow = stub(dvcReader, 'expShow').resolves(expShow)

  const mockGetCommitMessages = stub(gitReader, 'getCommitMessages').resolves(
    ''
  )

  const mockStageList = stub(dvcReader, 'stageList').resolves(
    stageList ?? undefined
  )
  const mockDag = stub(dvcReader, 'dag').resolves(dag)

  const resourceLocator = buildResourceLocator(disposer)

  return {
    config,
    dvcConfig,
    dvcExecutor,
    dvcReader,
    dvcRunner,
    dvcViewer,
    gitExecutor,
    gitReader,
    internalCommands,
    mockCheckSignalFile,
    mockCreateFileSystemWatcher,
    mockDag,
    mockDataStatus,
    mockExpShow,
    mockGetCommitMessages,
    mockPlotsDiff,
    mockStageList,
    resourceLocator
  }
}

export const getMessageReceivedEmitter = (
  webview: BaseWebview<PlotsData | TableData | SetupData>
): EventEmitter<MessageFromWebview> => (webview as any).messageReceived

export const getInputBoxEvent = (mockInputValue: string) => {
  const mockInput = stub(window, 'showInputBox')
  return new Promise(resolve =>
    mockInput.callsFake(() => {
      resolve(mockInputValue)
      return Promise.resolve(mockInputValue)
    })
  )
}

export const stubPrivateMethod = <T>(
  classWithPrivateMethod: T,
  method: string
) => stub(classWithPrivateMethod as any, method)

export const stubPrivatePrototypeMethod = <T extends { prototype: unknown }>(
  classWithPrivateMethod: T,
  method: string
) => stubPrivateMethod(classWithPrivateMethod.prototype, method)

export const spyOnPrivateMemberMethod = <T>(
  classWithPrivateMember: T,
  memberName: string,
  method: string
) => spy((classWithPrivateMember as any)[memberName], method)

export type SafeWatcherDisposer = Disposer & {
  disposeAndFlush: () => Promise<unknown>
}

export const getTimeSafeDisposer = (): Disposer & {
  disposeAndFlush: () => Promise<unknown>
} => {
  const disposer = Disposable.fn()
  return Object.assign(disposer, {
    disposeAndFlush: () => {
      disposer.dispose()
      return Time.delay(500)
    }
  })
}

export const bypassProgressCloseDelay = () =>
  stub(Toast, 'delayProgressClosing').resolves(undefined)

export const waitForEditorText = async (): Promise<unknown> => {
  await Time.delay(100)
  const text = window.activeTextEditor?.document.getText()
  if (text) {
    return
  }
  return waitForEditorText()
}

export const waitForSpyCall = async (
  messageSpy: SinonSpy,
  originalCallCount: number
): Promise<unknown> => {
  await Time.delay(100)
  if (messageSpy.callCount > originalCallCount) {
    return
  }
  return waitForSpyCall(messageSpy, originalCallCount)
}

export const getActiveEditorUpdatedEvent = (disposer: Disposer) =>
  new Promise(resolve => {
    const listener = disposer.track(
      window.onDidChangeActiveTextEditor(() => {
        resolve(undefined)
        disposer.untrack(listener)
        listener.dispose()
      })
    )
  })
