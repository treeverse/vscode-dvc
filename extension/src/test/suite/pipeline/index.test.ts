import { join } from 'path'
import { afterEach, beforeEach, describe, it, suite } from 'mocha'
import { SinonStub, restore, spy, stub } from 'sinon'
import { expect } from 'chai'
import { QuickPickItem, Uri, window } from 'vscode'
import { buildPipeline } from './util'
import {
  bypassProcessManagerDebounce,
  closeAllEditors,
  getActiveEditorUpdatedEvent,
  getMockNow
} from '../util'
import { Disposable } from '../../../extension'
import { dvcDemoPath } from '../../util'
import * as QuickPick from '../../../vscode/quickPick'
import { QuickPickOptionsWithTitle } from '../../../vscode/quickPick'
import * as FileSystem from '../../../fileSystem'
import { ScriptCommand } from '../../../pipeline'
import * as VscodeContext from '../../../vscode/context'
import * as PipelineQuickPick from '../../../pipeline/quickPick'

suite('Pipeline Test Suite', () => {
  const disposable = Disposable.fn()
  beforeEach(() => {
    restore()
  })

  afterEach(function () {
    disposable.dispose()
    return closeAllEditors()
  })

  describe('Pipeline', () => {
    it('should not show a modal when addPipeline is called', async () => {
      const mockInputBox = stub(window, 'showInputBox').resolves(undefined)
      const { mockShowInformation, pipeline } = buildPipeline({
        disposer: disposable,
        dvcYamls: []
      })
      await pipeline.isReady()
      await pipeline.addPipeline()
      expect(mockShowInformation).not.to.have.been.calledOnce
      expect(mockInputBox).to.have.been.calledOnce
    })

    it('should ask to create a stage and not return a cwd if there is no pipeline', async () => {
      const mockInputBox = stub(window, 'showInputBox').resolves(undefined)
      const { mockShowInformation, pipeline } = buildPipeline({
        disposer: disposable,
        dvcYamls: []
      })
      await pipeline.isReady()
      const cwd = await pipeline.getCwd()
      expect(
        mockShowInformation,
        'the user should be asked whether or not they want to add a stage'
      ).to.have.been.calledOnce
      expect(mockInputBox, 'the user should be prompted for a stage name').to
        .have.been.calledOnce
      expect(cwd, 'no cwd is returned').to.be.undefined
    })

    it('should not create a stage if the user does not want to add one', async () => {
      const mockInputBox = stub(window, 'showInputBox').resolves(undefined)
      const { mockShowInformation, pipeline } = buildPipeline({
        disposer: disposable,
        dvcYamls: []
      })
      mockShowInformation.resetBehavior()
      mockShowInformation.resolves(undefined)
      await pipeline.isReady()
      const cwd = await pipeline.getCwd()
      expect(
        mockShowInformation,
        'the user should be asked whether or not they want to add a stage'
      ).to
      expect(mockInputBox).not.to.have.been.called
      expect(cwd, 'no cwd is returned').to.be.undefined
    })

    it('should return a cwd if there is an invalid pipeline (let command fail)', async () => {
      const { pipeline } = buildPipeline({
        disposer: disposable,
        dvcRoot: dvcDemoPath,
        stageList: null
      })
      await pipeline.isReady()
      expect(pipeline.hasPipeline()).to.be.true
      const cwd = await pipeline.getCwd()
      expect(cwd).to.equal(dvcDemoPath)
    })

    it('should return a cwd if there is a single valid pipeline', async () => {
      const { pipeline } = buildPipeline({
        disposer: disposable,
        dvcRoot: dvcDemoPath,
        stageList: 'train'
      })
      await pipeline.isReady()
      expect(pipeline.hasPipeline()).to.be.true
      const cwd = await pipeline.getCwd()
      expect(cwd).to.equal(dvcDemoPath)
    })

    it('should return the project root if there are multiple pipelines but one is the root', async () => {
      const { pipeline } = buildPipeline({
        disposer: disposable,
        dvcRoot: dvcDemoPath,
        dvcYamls: [dvcDemoPath, join(dvcDemoPath, 'subdir')],
        stageList: 'train'
      })
      await pipeline.isReady()
      expect(pipeline.hasPipeline()).to.be.true
      const cwd = await pipeline.getCwd()
      expect(cwd).to.equal(dvcDemoPath)
    })

    it('should prompt the user to pick a pipeline if there are multiple pipelines and none are the root', async () => {
      const pickedPipeline = join(dvcDemoPath, 'nested1', 'dvc.yaml')
      const mockShowQuickPick = stub(window, 'showQuickPick') as SinonStub<
        [items: readonly QuickPickItem[], options: QuickPickOptionsWithTitle],
        Thenable<string | undefined>
      >
      mockShowQuickPick.resolves(pickedPipeline)
      const { pipeline } = buildPipeline({
        disposer: disposable,
        dvcRoot: dvcDemoPath,
        dvcYamls: [pickedPipeline, join(dvcDemoPath, 'nested2', 'dvc.yaml')],
        stageList: 'train'
      })
      await pipeline.isReady()
      expect(pipeline.hasPipeline()).to.be.true
      const cwd = await pipeline.getCwd()
      expect(cwd).to.equal(pickedPipeline)
      expect(mockShowQuickPick).to.be.calledOnce
    })

    it('should create a new stage given all of the required information from the user', async () => {
      const mockNow = getMockNow()
      const { pipeline } = buildPipeline({
        disposer: disposable,
        dvcRoot: dvcDemoPath,
        dvcYamls: []
      })
      bypassProcessManagerDebounce(mockNow)

      const mockInputBox = stub(window, 'showInputBox').resolves('train')
      const mockQuickPickOneOrInput = stub(
        QuickPick,
        'quickPickOneOrInput'
      ).resolves('train.py')
      const mockFindOrCreateDvcYamlFile = stub(
        FileSystem,
        'findOrCreateDvcYamlFile'
      ).resolves(undefined)

      await pipeline.checkOrAddPipeline()
      expect(mockInputBox).to.be.calledOnce
      expect(mockQuickPickOneOrInput).to.be.calledOnce
      expect(mockFindOrCreateDvcYamlFile).to.be.calledWithExactly(
        dvcDemoPath,
        'train.py',
        'train',
        'python',
        false
      )
    })

    it('should add jupyter nbconvert as a command to the dvc.yaml file if the file has the .ipynb extension', async () => {
      const mockNow = getMockNow()
      const { pipeline } = buildPipeline({
        disposer: disposable,
        dvcRoot: dvcDemoPath,
        dvcYamls: []
      })
      bypassProcessManagerDebounce(mockNow)
      const scriptPath = join('path', 'to', 'training_script.ipynb')
      const stageName = 'notebook_train'

      const mockInputBox = stub(window, 'showInputBox').resolves(stageName)
      const mockQuickPickOneOrInput = stub(
        QuickPick,
        'quickPickOneOrInput'
      ).resolves(scriptPath)
      const mockFindOrCreateDvcYamlFile = stub(
        FileSystem,
        'findOrCreateDvcYamlFile'
      ).resolves(undefined)

      await pipeline.checkOrAddPipeline()
      expect(mockInputBox).to.be.calledOnce
      expect(mockQuickPickOneOrInput).to.be.calledOnce
      expect(mockFindOrCreateDvcYamlFile).to.be.calledWithExactly(
        dvcDemoPath,
        scriptPath,
        stageName,
        ScriptCommand.JUPYTER,
        false
      )
    })

    it('should ask to enter a custom command if the file is not a Python file or Jupyter notebook', async () => {
      const mockNow = getMockNow()
      const { pipeline } = buildPipeline({
        disposer: disposable,
        dvcRoot: dvcDemoPath,
        dvcYamls: []
      })
      bypassProcessManagerDebounce(mockNow)
      const scriptCommand = 'go run'
      const scriptPath = join('path', 'to', 'go-go-run.go')
      const stageName = 'go-train'

      const mockInputBox = stub(window, 'showInputBox')
        .onFirstCall()
        .resolves(stageName)
        .onSecondCall()
        .resolves(scriptCommand)
      const mockQuickPickOneOrInput = stub(
        QuickPick,
        'quickPickOneOrInput'
      ).resolves(scriptPath)
      const mockFindOrCreateDvcYamlFile = stub(
        FileSystem,
        'findOrCreateDvcYamlFile'
      ).resolves(undefined)

      await pipeline.checkOrAddPipeline()
      expect(mockInputBox).to.be.calledTwice
      expect(mockQuickPickOneOrInput).to.be.calledOnce
      expect(mockFindOrCreateDvcYamlFile).to.be.calledWithExactly(
        dvcDemoPath,
        scriptPath,
        stageName,
        scriptCommand,
        false
      )
    })

    it('should ask to convert the script path to a relative path if the path was provided via the file picker', async () => {
      const mockNow = getMockNow()
      const { pipeline } = buildPipeline({
        disposer: disposable,
        dvcRoot: dvcDemoPath,
        dvcYamls: []
      })
      bypassProcessManagerDebounce(mockNow)
      const scriptCommand = 'node'
      const scriptPath = join(dvcDemoPath, 'path', 'to', 'training_script.js')
      const stageName = 'whoTrainsInJavascript'

      const mockInputBox = stub(window, 'showInputBox')
        .onFirstCall()
        .resolves(stageName)
        .onSecondCall()
        .resolves(scriptCommand)
      const mockQuickPickOneOrInput = stub(
        QuickPick,
        'quickPickOneOrInput'
      ).resolves('select')
      const mockShowOpenDialog = stub(window, 'showOpenDialog').resolves([
        Uri.file(scriptPath)
      ])

      const mockFindOrCreateDvcYamlFile = stub(
        FileSystem,
        'findOrCreateDvcYamlFile'
      ).resolves(undefined)

      await pipeline.checkOrAddPipeline()
      expect(mockInputBox).to.be.calledTwice
      expect(mockQuickPickOneOrInput).to.be.calledOnce
      expect(mockShowOpenDialog).to.be.calledOnce
      expect(mockFindOrCreateDvcYamlFile).to.be.calledWithExactly(
        dvcDemoPath,
        scriptPath,
        stageName,
        scriptCommand,
        true
      )
    })

    it('should not add a stage if a name was not given', async () => {
      const { pipeline } = buildPipeline({
        disposer: disposable,
        dvcRoot: dvcDemoPath,
        dvcYamls: []
      })

      const mockInputBox = stub(window, 'showInputBox').resolves(undefined)
      const mockQuickPickOneOrInput = stub(QuickPick, 'quickPickOneOrInput')
      const mockFindOrCreateDvcYamlFile = stub(
        FileSystem,
        'findOrCreateDvcYamlFile'
      )

      await pipeline.checkOrAddPipeline()
      expect(mockInputBox).to.be.calledOnce
      expect(mockQuickPickOneOrInput).not.to.be.called
      expect(mockFindOrCreateDvcYamlFile).not.to.be.called
    })

    it('should not add a stage if a training script was not given', async () => {
      const { pipeline } = buildPipeline({
        disposer: disposable,
        dvcRoot: dvcDemoPath,
        dvcYamls: []
      })

      const mockInputBox = stub(window, 'showInputBox').resolves('mega_train')
      const mockQuickPickOneOrInput = stub(
        QuickPick,
        'quickPickOneOrInput'
      ).resolves(undefined)
      const mockFindOrCreateDvcYamlFile = stub(
        FileSystem,
        'findOrCreateDvcYamlFile'
      )

      await pipeline.checkOrAddPipeline()
      expect(mockInputBox).to.be.calledOnce
      expect(mockQuickPickOneOrInput).to.be.calledOnce
      expect(mockFindOrCreateDvcYamlFile).not.to.be.called
    })

    it('should add a data series plot when a dvc.yaml file exists', async () => {
      const { pipeline } = buildPipeline({
        disposer: disposable
      })
      const mockPickPlotConfiguration = stub(
        PipelineQuickPick,
        'pickPlotConfiguration'
      )
      const mockAddPlotToDvcFile = stub(FileSystem, 'addPlotToDvcYamlFile')

      await pipeline.isReady()

      mockPickPlotConfiguration.onFirstCall().resolves(undefined)

      await pipeline.addDataSeriesPlot()

      expect(mockPickPlotConfiguration).to.be.calledOnceWithExactly(dvcDemoPath)
      expect(mockAddPlotToDvcFile).not.to.be.called

      const mockPlotConfig: PipelineQuickPick.PlotConfigData = {
        template: 'simple',
        title: 'Great Plot Name',
        x: { 'results.json': ['step'] },
        y: { 'results.json': ['acc'] }
      }

      mockPickPlotConfiguration.onSecondCall().resolves(mockPlotConfig)

      await pipeline.addDataSeriesPlot()

      expect(mockPickPlotConfiguration).to.be.calledWithExactly(dvcDemoPath)
      expect(mockAddPlotToDvcFile).to.be.calledOnceWithExactly(
        dvcDemoPath,
        mockPlotConfig
      )
    })

    it('should add a data series plot without trying to add a missing dvc.yaml file or stage', async () => {
      const { pipeline } = buildPipeline({
        disposer: disposable,
        dvcYamls: []
      })
      const mockPickPlotConfiguration = stub(
        PipelineQuickPick,
        'pickPlotConfiguration'
      )
      const mockAddPlotToDvcFile = stub(FileSystem, 'addPlotToDvcYamlFile')
      const mockCheckOrAddPipeline = stub(pipeline, 'checkOrAddPipeline')
      const mockPlotConfig: PipelineQuickPick.PlotConfigData = {
        template: 'simple',
        title: 'Great Plot Name',
        x: { 'results.json': ['step'] },
        y: { 'results.json': ['acc'] }
      }

      mockPickPlotConfiguration.onFirstCall().resolves(mockPlotConfig)

      await pipeline.isReady()
      await pipeline.addDataSeriesPlot()

      expect(mockCheckOrAddPipeline, 'should not check for a pipeline stage')
        .not.to.be.called
      expect(mockPickPlotConfiguration).to.be.calledOnceWithExactly(dvcDemoPath)
      expect(mockAddPlotToDvcFile).to.be.calledOnceWithExactly(
        dvcDemoPath,
        mockPlotConfig
      )
    })

    it('should set the appropriate context value when a dvc.yaml is open in the active editor', async () => {
      const dvcYaml = Uri.file(join(dvcDemoPath, 'dvc.yaml'))
      await window.showTextDocument(dvcYaml)

      const mockContext: { [key: string]: unknown } = {
        'dvc.pipeline.file.active': false
      }

      const mockSetContextValue = stub(VscodeContext, 'setContextValue')
      mockSetContextValue.callsFake((key: string, value: unknown) => {
        mockContext[key] = value
        return Promise.resolve(undefined)
      })

      const { pipeline } = buildPipeline({ disposer: disposable })
      await pipeline.isReady()

      expect(
        mockContext['dvc.pipeline.file.active'],
        'should set dvc.pipeline.file.active to true when a dvc.yaml is open and the extension starts'
      ).to.be.true

      mockSetContextValue.resetHistory()

      const startupEditorClosed = getActiveEditorUpdatedEvent(disposable)

      await closeAllEditors()
      await startupEditorClosed

      expect(
        mockContext['dvc.pipeline.file.active'],
        'should set dvc.pipeline.file.active to false when the dvc.yaml in the active editor is closed'
      ).to.be.false

      mockSetContextValue.resetHistory()

      const activeEditorUpdated = getActiveEditorUpdatedEvent(disposable)

      await window.showTextDocument(dvcYaml)
      await activeEditorUpdated

      const activeEditorClosed = getActiveEditorUpdatedEvent(disposable)

      expect(
        mockContext['dvc.pipeline.file.active'],
        'should set dvc.pipeline.file.active to true when a dvc.yaml file is in the active editor'
      ).to.be.true

      await closeAllEditors()
      await activeEditorClosed

      expect(
        mockContext['dvc.pipeline.file.active'],
        'should set dvc.pipeline.file.active to false when the dvc.yaml in the active editor is closed again'
      ).to.be.false
    })

    it('should set dvc.pipeline.file.active to false when a dvc.yaml is not open and the extension starts', async () => {
      const nonDvcYaml = Uri.file(join(dvcDemoPath, '.gitignore'))
      await window.showTextDocument(nonDvcYaml)

      const setContextValueSpy = spy(VscodeContext, 'setContextValue')

      const { pipeline } = buildPipeline({ disposer: disposable })
      await pipeline.isReady()

      expect(setContextValueSpy).to.be.calledWith(
        'dvc.pipeline.file.active',
        false
      )
    })
  })
})
