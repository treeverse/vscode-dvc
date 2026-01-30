import path from 'path'
import { afterEach, beforeEach, describe, it, suite } from 'mocha'
import { expect } from 'chai'
import { stub, restore, spy } from 'sinon'
import { ensureFileSync } from 'fs-extra'
import {
  EventEmitter,
  window,
  commands,
  Uri,
  MessageItem,
  ViewColumn,
  WorkspaceEdit,
  workspace
} from 'vscode'
import { Disposable } from '../../../../extension'
import { DvcExecutor } from '../../../../cli/dvc/executor'
import {
  activeTextEditorChangedEvent,
  buildDependencies,
  closeAllEditors,
  getActiveTextEditorFilename,
  stubPrivatePrototypeMethod,
  waitForEditorText
} from '../../util'
import { dvcDemoPath } from '../../../util'
import {
  RegisteredCliCommands,
  RegisteredCommands
} from '../../../../commands/external'
import { WEBVIEW_TEST_TIMEOUT } from '../../timeouts'
import { Repository } from '../../../../repository'
import { WorkspaceRepositories } from '../../../../repository/workspace'
import { RepositoriesTree } from '../../../../repository/model/tree'
import { DOT_DVC } from '../../../../cli/dvc/constants'

suite('Repositories Tree Test Suite', () => {
  const { join } = path

  const getPathItem = (relPath: string, isTracked = true) => ({
    dvcRoot: dvcDemoPath,
    isTracked,
    resourceUri: Uri.file(join(dvcDemoPath, relPath))
  })

  const disposable = Disposable.fn()
  beforeEach(() => {
    restore()
  })

  afterEach(function () {
    this.timeout(6000)
    disposable.dispose()
    return closeAllEditors()
  })

  describe('RepositoriesTree', () => {
    it('should appear in the UI', async () => {
      await expect(
        commands.executeCommand('dvc.views.trackedExplorerTree.focus')
      ).to.be.eventually.equal(undefined)
    })

    it('should be able to run dvc.copyFilePath and copy a path to the clipboard', async () => {
      await commands.executeCommand(
        RegisteredCommands.TRACKED_EXPLORER_COPY_FILE_PATH,
        { resourceUri: Uri.file(dvcDemoPath) }
      )

      await commands.executeCommand('workbench.action.files.newUntitledFile')
      await commands.executeCommand('editor.action.clipboardPasteAction')
      await waitForEditorText()

      expect(
        Uri.file(window.activeTextEditor?.document.getText() as string).fsPath
      ).to.equal(dvcDemoPath)
    })

    it('should be able to run dvc.copyRelativeFilePath and copy a path to the clipboard', async () => {
      const relPath = 'logs'
      await commands.executeCommand(
        RegisteredCommands.TRACKED_EXPLORER_COPY_REL_FILE_PATH,
        getPathItem(relPath)
      )

      await commands.executeCommand('workbench.action.files.newUntitledFile')
      await commands.executeCommand('editor.action.clipboardPasteAction')
      await waitForEditorText()

      expect(window.activeTextEditor?.document.getText()).to.equal(relPath)
    })

    it('should be able to run dvc.deleteTarget without error', async () => {
      const mockApplyEdit = stub(workspace, 'applyEdit').resolves(undefined)

      await commands.executeCommand(
        RegisteredCommands.DELETE_TARGET,
        getPathItem('deletable.txt')
      )

      expect(mockApplyEdit).to.be.calledOnce
    })

    it('should be able to add data to a tracked data directory (.dvc)', async () => {
      const mockData = [
        'extra-data.txt',
        'more-extra-data.txt',
        'even-more-extra-data.txt'
      ]

      const mockDestination = getPathItem(join('data', 'MNIST', 'raw'))

      const mockDestinationPath = mockDestination.resourceUri.fsPath

      ensureFileSync(mockDestinationPath + DOT_DVC)

      const expectedTargets = mockData.map(file => join(dvcDemoPath, file))
      const expectedDestinations = mockData.map(file =>
        join(mockDestinationPath, file)
      )

      const mockUris = expectedTargets.map(file => Uri.file(file))

      const mockResourcePicker = stub(window, 'showOpenDialog').resolves(
        mockUris
      )

      const mockRename = stub(WorkspaceEdit.prototype, 'renameFile').resolves(
        undefined
      )

      stub(window, 'showWarningMessage').resolves(
        'Move' as unknown as MessageItem
      )

      await commands.executeCommand('dvc.moveTargets', mockDestination)

      expect(mockResourcePicker).to.be.calledOnce
      expect(mockRename).to.be.calledThrice

      for (let i = 0; i <= 2; i++) {
        const [target, dest] = mockRename.getCall(i).args
        expect(target.fsPath).to.equal(expectedTargets[i])
        expect(dest.fsPath).to.equal(expectedDestinations[i])
      }
    })

    it('should not add data to a tracked data directory if the user changes their mind', async () => {
      const mockData = ['data-i-will-not-move.txt']
      const mockDestination = getPathItem(join('data', 'MNIST', 'raw'))

      const mockUris = mockData.map(file => Uri.file(join(dvcDemoPath, file)))

      const mockResourcePicker = stub(window, 'showOpenDialog').resolves(
        mockUris
      )

      const mockRename = stub(WorkspaceEdit.prototype, 'renameFile').resolves(
        undefined
      )

      stub(window, 'showWarningMessage').resolves(
        'Cancel' as unknown as MessageItem
      )

      await commands.executeCommand('dvc.moveTargets', mockDestination)

      expect(mockResourcePicker).to.be.calledOnce
      expect(mockRename).not.to.be.called
    })

    it('should be able to open a file', async () => {
      const fileToOpen = join(dvcDemoPath, 'train.py')
      expect(getActiveTextEditorFilename()).not.to.equal(fileToOpen)
      const uri = Uri.file(fileToOpen)

      const activeEditorChanged = activeTextEditorChangedEvent(disposable)

      await commands.executeCommand(
        RegisteredCommands.TRACKED_EXPLORER_OPEN_FILE,
        uri
      )
      await activeEditorChanged

      expect(getActiveTextEditorFilename()).to.equal(fileToOpen)
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should be able to open a file to the side', async () => {
      const fileToOpen = join(dvcDemoPath, 'pyproject.toml')
      expect(getActiveTextEditorFilename()).not.to.equal(fileToOpen)

      const activeEditorChanged = activeTextEditorChangedEvent(disposable)

      await commands.executeCommand(
        RegisteredCommands.TRACKED_EXPLORER_OPEN_TO_THE_SIDE,
        { resourceUri: Uri.file(fileToOpen) }
      )
      await activeEditorChanged

      expect(getActiveTextEditorFilename()).to.equal(fileToOpen)
      expect(window.activeTextEditor?.viewColumn).not.to.equal(ViewColumn.One)
    })

    it('should be able to search in a folder', async () => {
      const searchDir = Uri.file(join(dvcDemoPath, 'data'))
      const executeCommandSpy = spy(commands, 'executeCommand')

      await commands.executeCommand(
        RegisteredCommands.TRACKED_EXPLORER_FIND_IN_FOLDER,
        { resourceUri: searchDir }
      )

      expect(executeCommandSpy).to.be.calledWith(
        'filesExplorer.findInFolder',
        searchDir
      )
    })

    it('should be able to compare two files', async () => {
      const baseline = Uri.file(join(dvcDemoPath, 'dvc.yaml'))
      const comparison = Uri.file(join(dvcDemoPath, 'pyproject.toml'))
      const executeCommandSpy = spy(commands, 'executeCommand')

      await commands.executeCommand(
        RegisteredCommands.TRACKED_EXPLORER_SELECT_FOR_COMPARE,
        { resourceUri: baseline }
      )

      expect(
        executeCommandSpy,
        'should call executeCommand with the args required to select a file to compare against'
      ).to.be.calledWith('selectForCompare', baseline)
      executeCommandSpy.resetHistory()

      await commands.executeCommand(
        RegisteredCommands.TRACKED_EXPLORER_COMPARE_SELECTED,
        { resourceUri: comparison }
      )

      expect(
        executeCommandSpy,
        'should call executeCommand with the args required to compare the files'
      ).to.be.calledWith('compareFiles', comparison)
    })

    it('should be able to run dvc.removeTarget without error', async () => {
      const relPath = join('mock', 'data', 'MNIST', 'raw')
      stub(path, 'relative').returns(relPath)

      const mockRemove = stub(DvcExecutor.prototype, 'remove').resolves(
        'target destroyed!'
      )

      await commands.executeCommand(
        RegisteredCliCommands.REMOVE_TARGET,
        getPathItem(relPath)
      )
      expect(mockRemove).to.be.calledOnce
    })

    it('should pull the correct target(s) when asked to dvc.pullTarget a non-tracked directory', async () => {
      const { gitReader, internalCommands, mockDataStatus } = buildDependencies(
        { disposer: disposable }
      )

      mockDataStatus.resetBehavior()
      mockDataStatus.resolves({
        unchanged: [
          join('data', 'data.xml'),
          join('data', 'features'),
          join('data', 'features', 'test.pkl'),
          join('data', 'features', 'train.pkl'),
          join('data', 'prepared'),
          join('data', 'prepared', 'test.tsv'),
          join('data', 'prepared', 'train.tsv'),
          join('evaluation', 'importance.png'),
          'model.pkl'
        ]
      })
      stub(gitReader, 'listUntracked').resolves(new Set())

      const repository = disposable.track(
        new Repository(
          dvcDemoPath,
          internalCommands,
          disposable.track(new EventEmitter<void>()),
          []
        )
      )

      stub(WorkspaceRepositories.prototype, 'getRepository').returns(repository)
      stub(WorkspaceRepositories.prototype, 'isReady').resolves(undefined)
      stubPrivatePrototypeMethod(
        RepositoriesTree,
        'getSelectedPathItems'
      ).returns([])
      const mockPull = stub(DvcExecutor.prototype, 'pull').resolves(
        'target pulled'
      )

      await repository.isReady()

      await commands.executeCommand(
        RegisteredCliCommands.PULL_TARGET,
        getPathItem('data', false)
      )

      expect(mockPull).to.be.calledOnce
      expect(mockPull).to.be.calledWithExactly(
        dvcDemoPath,
        join('data', 'data.xml'),
        join('data', 'features'),
        join('data', 'prepared')
      )
    })

    it('should be able to run dvc.pullTarget without error', async () => {
      const relPath = 'data'
      stub(path, 'relative').returns(relPath)

      const mockPull = stub(DvcExecutor.prototype, 'pull').resolves(
        'target pulled'
      )
      stubPrivatePrototypeMethod(
        RepositoriesTree,
        'getSelectedPathItems'
      ).returns([getPathItem(relPath)])

      await commands.executeCommand(
        RegisteredCliCommands.PULL_TARGET,
        getPathItem(relPath)
      )

      expect(mockPull).to.be.calledOnce
    })

    it('should prompt to force if dvc.pullTarget fails', async () => {
      const relPath = join('data', 'MNIST')

      stub(path, 'relative').returns(relPath)

      const mockPull = stub(DvcExecutor.prototype, 'pull')
        .onFirstCall()
        .rejects({
          stderr: "Use '-f' to force."
        })
        .onSecondCall()
        .resolves('')
      const mockShowWarningMessage = stub(
        window,
        'showWarningMessage'
      ).resolves('Force' as unknown as MessageItem)

      stubPrivatePrototypeMethod(
        RepositoriesTree,
        'getSelectedPathItems'
      ).returns([getPathItem(relPath)])

      await commands.executeCommand(
        RegisteredCliCommands.PULL_TARGET,
        getPathItem(relPath)
      )

      expect(mockShowWarningMessage).to.be.calledOnce
      expect(mockPull).to.be.calledTwice
      expect(mockPull).to.be.calledWith(dvcDemoPath, relPath)
      expect(mockPull).to.be.calledWith(dvcDemoPath, relPath, '-f')
    })

    it('should be able to run dvc.pushTarget without error', async () => {
      const relPath = join('data', 'MNIST')
      stub(path, 'relative').returns(relPath)

      const mockPush = stub(DvcExecutor.prototype, 'push').resolves(
        'target pushed'
      )

      stubPrivatePrototypeMethod(
        RepositoriesTree,
        'getSelectedPathItems'
      ).returns([getPathItem(relPath)])

      await commands.executeCommand(
        RegisteredCliCommands.PUSH_TARGET,
        getPathItem(relPath)
      )

      expect(mockPush).to.be.calledOnce
    })

    it('should prompt to force if dvc.pushTarget fails', async () => {
      const relPath = join('data', 'MNIST')
      stub(path, 'relative').returns(relPath)

      const mockPush = stub(DvcExecutor.prototype, 'push')
        .onFirstCall()
        .rejects({
          stderr: "I AM AN ERROR. Use '-f' to force."
        })
        .onSecondCall()
        .resolves('')
      const mockShowWarningMessage = stub(
        window,
        'showWarningMessage'
      ).resolves('Force' as unknown as MessageItem)

      stubPrivatePrototypeMethod(
        RepositoriesTree,
        'getSelectedPathItems'
      ).returns([])

      await commands.executeCommand(
        RegisteredCliCommands.PUSH_TARGET,
        getPathItem(relPath)
      )

      expect(mockShowWarningMessage).to.be.calledWith(
        'I AM AN ERROR. \n\nWould you like to force this action?',
        { modal: true },
        'Force'
      )
      expect(mockPush).to.be.calledTwice
      expect(mockPush).to.be.calledWith(dvcDemoPath, relPath)
      expect(mockPush).to.be.calledWith(dvcDemoPath, relPath, '-f')
    })
  })
})
