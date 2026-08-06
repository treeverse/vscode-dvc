import { join } from 'path'
import { afterEach, beforeEach, describe, it, suite } from 'mocha'
import { expect } from 'chai'
import { restore, spy, stub } from 'sinon'
import { commands, TextDocument, Uri, window } from 'vscode'
import isEqual from 'lodash.isequal'
import { buildPlots, buildPlotsWebview } from '../plots/util'
import expShowFixtureWithoutErrors from '../../fixtures/expShow/base/noErrors'
import gitLogFixture from '../../fixtures/expShow/base/gitLog'
import rowOrderFixture from '../../fixtures/expShow/base/rowOrder'
import customPlotsFixture from '../../fixtures/expShow/base/customPlots'
import plotsDiffFixture from '../../fixtures/plotsDiff/output'
import templatePlotsFixture from '../../fixtures/plotsDiff/template'
import comparisonPlotsFixture from '../../fixtures/plotsDiff/comparison/vscode'
import plotsRevisionsFixture from '../../fixtures/plotsDiff/revisions'
import {
  bypassProcessManagerDebounce,
  closeAllEditors,
  getFirstArgOfLastCall,
  getMockNow,
  getTimeSafeDisposer,
  waitForSpyCall
} from '../util'
import { dvcDemoPath } from '../../util'
import {
  DEFAULT_PLOT_HEIGHT,
  DEFAULT_SECTION_COLLAPSED,
  PlotsData as TPlotsData,
  PlotsSection,
  TemplatePlotGroup,
  ImagePlot
} from '../../../plots/webview/contract'
import { TEMP_PLOTS_DIR } from '../../../cli/dvc/constants'
import { WEBVIEW_TEST_TIMEOUT } from '../timeouts'
import { MessageFromWebviewType } from '../../../webview/contract'
import { reorderObjectList, uniqueValues } from '../../../util/array'
import * as Telemetry from '../../../telemetry'
import { EventName } from '../../../telemetry/constants'
import { ErrorItem } from '../../../path/selection/tree'
import { isErrorItem } from '../../../tree'
import { RegisteredCommands } from '../../../commands/external'
import { REVISIONS } from '../../fixtures/plotsDiff'
import * as FileSystem from '../../../fileSystem'
import {
  PLOT_ANCHORS,
  EXPERIMENT_WORKSPACE_ID,
  ExpShowOutput,
  TemplatePlotOutput,
  experimentHasError
} from '../../../cli/dvc/contract'
import { Experiment } from '../../../experiments/webview/contract'
import { COMMITS_SEPARATOR } from '../../../cli/git/constants'
import { BaseWebview } from '../../../webview'
import * as PlotsCollectUtils from '../../../plots/model/collect'
import { Operator } from '../../../experiments/model/filterBy'
import * as External from '../../../vscode/external'
import { PlotPath } from '../../../plots/paths/collect'

suite('Plots Test Suite', () => {
  const disposable = getTimeSafeDisposer()

  beforeEach(() => {
    restore()
  })

  afterEach(async function () {
    this.timeout(6000)
    await disposable.disposeAndFlush()
    return closeAllEditors()
  })

  // eslint-disable-next-line sonarjs/cognitive-complexity
  describe('Plots', () => {
    it('should call plots diff once on instantiation with missing revisions if there are no plots', async () => {
      const { mockPlotsDiff, plots, data } = await buildPlots({
        disposer: disposable,
        plotsDiff: { data: {} }
      })
      const messageSpy = spy(BaseWebview.prototype, 'show')

      const managedUpdateSpy = spy(data, 'managedUpdate')

      expect(mockPlotsDiff).to.be.calledOnce
      expect(mockPlotsDiff).to.be.calledWithExactly(
        dvcDemoPath,
        REVISIONS[0],
        REVISIONS[2],
        REVISIONS[3],
        REVISIONS[4],
        REVISIONS[1]
      )
      mockPlotsDiff.resetHistory()

      const messageSent = waitForSpyCall(messageSpy, messageSpy.callCount)

      const webview = await plots.showWebview()

      await Promise.all([webview.isReady(), messageSent])

      expect(mockPlotsDiff).not.to.be.called
      expect(managedUpdateSpy).not.to.be.called

      expect(messageSpy).to.be.calledOnce
      expect(messageSpy).to.be.calledWithMatch({
        comparison: null,
        sectionCollapsed: DEFAULT_SECTION_COLLAPSED,
        template: null
      })
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should call plots diff with the commit whenever the current commit changes', async () => {
      const mockNow = getMockNow()
      const noExperimentFixture = expShowFixtureWithoutErrors.map(exp => ({
        ...exp,
        experiments: null
      }))

      const newCommit = '9235a02880a0372545e5f7f4d79a5d9eee6331ac'

      const { data, experiments, mockPlotsDiff } = await buildPlots({
        disposer: disposable,
        expShow: noExperimentFixture,
        plotsDiff: plotsDiffFixture
      })

      mockPlotsDiff.resetHistory()

      const updatedExpShowFixture = noExperimentFixture.map(exp => {
        if (exp.rev === '53c3851f46955fa3e2b8f6e1c52999acc8c9ea77') {
          if (experimentHasError(exp)) {
            throw new Error('Experiment should not have error')
          }

          return {
            ...exp,
            data: {
              ...exp.data,
              rev: newCommit
            },
            rev: newCommit
          }
        }

        return exp
      })

      const dataUpdateEvent = new Promise(resolve =>
        disposable.track(data.onDidUpdate(() => resolve(undefined)))
      )

      bypassProcessManagerDebounce(mockNow)
      void experiments.setState({
        availableNbCommits: { main: 6 },
        expShow: updatedExpShowFixture as ExpShowOutput,
        gitLog: newCommit + COMMITS_SEPARATOR + gitLogFixture,
        rowOrder: [{ branch: 'main', sha: newCommit }, ...rowOrderFixture]
      })

      await dataUpdateEvent

      expect(mockPlotsDiff).to.be.calledOnce
      expect(mockPlotsDiff).to.be.calledWithExactly(
        dvcDemoPath,
        REVISIONS[0],
        REVISIONS[1]
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should remove the temporary plots directory on dispose', async () => {
      const { mockRemoveDir, plots } = await buildPlots({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      plots.dispose()

      expect(mockRemoveDir).to.be.calledOnce
      expect(mockRemoveDir).to.be.calledWithExactly(
        join(dvcDemoPath, TEMP_PLOTS_DIR)
      )
    })

    it('should only use unfiltered experiments and commits in custom plots', async () => {
      const { plots, plotsModel, experimentsModel } = await buildPlots({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const plotsCustomPlotsSpy = spy(PlotsCollectUtils, 'collectCustomPlots')

      await plots.isReady()

      stub(experimentsModel, 'getFilters')
        .onFirstCall()
        .returns([
          {
            operator: Operator.EQUAL,
            path: 'params:params.yaml:epochs',
            value: 2
          }
        ])

      plotsModel.getCustomPlots()

      const allExperiments: Experiment[] =
        experimentsModel.getWorkspaceCommitsAndExperiments()

      const { experiments } = plotsCustomPlotsSpy.firstCall.args[0]

      expect(experiments).to.deep.equal(
        allExperiments.filter(
          ({ id, params }) =>
            id !== EXPERIMENT_WORKSPACE_ID &&
            params?.['params.yaml']?.epochs === 2
        )
      )
    })

    it('should handle sending custom plots when all experiments/commits being filtered', async () => {
      const { plots, plotsModel, experimentsModel } = await buildPlots({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      await plots.isReady()

      stub(experimentsModel, 'getUnfilteredCommitsAndExperiments')
        .onFirstCall()
        .returns([])

      const customPlots = plotsModel.getCustomPlots()

      expect(customPlots).to.deep.equal({
        ...customPlotsFixture,
        hasUnfilteredExperiments: false,
        plots: []
      })
    })

    it('should handle sending custom plots when no plots have been added yet', async () => {
      const { plots, plotsModel } = await buildPlots({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      await plots.isReady()

      stub(plotsModel, 'getCustomPlotsOrder').onFirstCall().returns([])

      const customPlots = plotsModel.getCustomPlots()

      expect(customPlots).to.deep.equal({
        ...customPlotsFixture,
        hasAddedPlots: false,
        plots: []
      })
    })

    it('should handle a section resized message from the webview', async () => {
      const { mockMessageReceived, plotsModel } = await buildPlotsWebview({
        disposer: disposable
      })

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')

      const mockSetPlotSize = stub(
        plotsModel,
        'setNbItemsPerRowOrWidth'
      ).returns(undefined)

      mockMessageReceived.fire({
        payload: {
          height: DEFAULT_PLOT_HEIGHT,
          nbItemsPerRow: 3,
          section: PlotsSection.TEMPLATE_PLOTS
        },
        type: MessageFromWebviewType.RESIZE_PLOTS
      })

      expect(mockSetPlotSize).to.be.calledOnce
      expect(mockSetPlotSize).to.be.calledWithExactly(
        PlotsSection.TEMPLATE_PLOTS,
        3
      )
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_SECTION_RESIZED,
        {
          height: DEFAULT_PLOT_HEIGHT,
          nbItemsPerRow: 3,
          section: PlotsSection.TEMPLATE_PLOTS
        },
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle a section collapsed message from the webview', async () => {
      const { mockMessageReceived, plotsModel, messageSpy } =
        await buildPlotsWebview({
          disposer: disposable
        })

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')

      const mockSetSectionCollapsed = spy(plotsModel, 'setSectionCollapsed')
      const mockSectionCollapsed = { [PlotsSection.CUSTOM_PLOTS]: true }

      messageSpy.resetHistory()
      mockMessageReceived.fire({
        payload: mockSectionCollapsed,
        type: MessageFromWebviewType.TOGGLE_PLOTS_SECTION
      })

      expect(mockSetSectionCollapsed).to.be.calledOnce
      expect(mockSetSectionCollapsed).to.be.calledWithExactly(
        mockSectionCollapsed
      )
      expect(messageSpy).to.be.calledOnce
      expect(
        messageSpy,
        "should update the webview's section collapsed state"
      ).to.be.calledWithExactly({
        sectionCollapsed: {
          ...DEFAULT_SECTION_COLLAPSED,
          ...mockSectionCollapsed
        }
      })
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_SECTION_TOGGLE,
        mockSectionCollapsed,
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle a comparison revisions reordered message from the webview', async () => {
      const { messageSpy, mockMessageReceived, plotsModel } =
        await buildPlotsWebview({
          disposer: disposable,
          plotsDiff: plotsDiffFixture
        })

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')

      const mockSetComparisonOrder = spy(plotsModel, 'setComparisonOrder')
      const mockComparisonOrder = [
        REVISIONS[2],
        REVISIONS[0],
        REVISIONS[3],
        REVISIONS[1],
        REVISIONS[4]
      ]

      messageSpy.resetHistory()
      mockMessageReceived.fire({
        payload: mockComparisonOrder,
        type: MessageFromWebviewType.REORDER_PLOTS_COMPARISON
      })

      expect(mockSetComparisonOrder).to.be.calledOnce
      expect(mockSetComparisonOrder).to.be.calledWithExactly(
        mockComparisonOrder
      )
      expect(messageSpy).to.be.calledOnce
      expect(
        messageSpy,
        "should update the webview's comparison revision state"
      ).to.be.calledWithExactly({
        comparison: {
          ...comparisonPlotsFixture,
          revisions: reorderObjectList(
            mockComparisonOrder,
            comparisonPlotsFixture.revisions,
            'id'
          )
        }
      })
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_REVISIONS_REORDERED,
        undefined,
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle a comparison rows reordered message from the webview', async () => {
      const { messageSpy, mockMessageReceived, pathsModel } =
        await buildPlotsWebview({
          disposer: disposable,
          plotsDiff: plotsDiffFixture
        })

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')

      const mockSetComparisonPathsOrder = spy(
        pathsModel,
        'setComparisonPathsOrder'
      )
      const mockComparisonPathsOrder = [
        join('plots', 'acc.png'),
        join('plots', 'heatmap.png'),
        join('plots', 'loss.png'),
        join('plots', 'image')
      ]

      messageSpy.resetHistory()
      mockMessageReceived.fire({
        payload: mockComparisonPathsOrder,
        type: MessageFromWebviewType.REORDER_PLOTS_COMPARISON_ROWS
      })

      expect(mockSetComparisonPathsOrder).to.be.calledOnce
      expect(mockSetComparisonPathsOrder).to.be.calledWithExactly(
        mockComparisonPathsOrder
      )
      expect(messageSpy).to.be.calledOnce
      expect(
        messageSpy,
        "should update the webview's comparison revision state"
      ).to.be.calledWithExactly({
        comparison: {
          ...comparisonPlotsFixture,
          plots: reorderObjectList(
            mockComparisonPathsOrder,
            comparisonPlotsFixture.plots,
            'path'
          )
        }
      })
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_COMPARISON_ROWS_REORDERED,
        undefined,
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle a template plots reordered message from the webview', async () => {
      const { pathsModel, messageSpy, mockMessageReceived } =
        await buildPlotsWebview({
          disposer: disposable,
          plotsDiff: plotsDiffFixture
        })

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')

      const mockSetTemplateOrder = spy(pathsModel, 'setTemplateOrder')
      const mockTemplateOrder = [
        { group: TemplatePlotGroup.MULTI_VIEW, paths: ['predictions.json'] },
        {
          group: TemplatePlotGroup.SINGLE_VIEW,
          paths: [join('logs', 'loss.tsv'), join('logs', 'acc.tsv')]
        }
      ]

      messageSpy.resetHistory()
      mockMessageReceived.fire({
        payload: mockTemplateOrder,
        type: MessageFromWebviewType.REORDER_PLOTS_TEMPLATES
      })

      expect(mockSetTemplateOrder).to.be.calledOnce
      expect(mockSetTemplateOrder).to.be.calledWithExactly(mockTemplateOrder)
      expect(messageSpy).to.be.calledOnce
      expect(
        messageSpy,
        "should update the webview's template plot state"
      ).to.be.calledWithExactly({
        template: {
          ...templatePlotsFixture,
          plots: reorderObjectList(
            [TemplatePlotGroup.MULTI_VIEW, TemplatePlotGroup.SINGLE_VIEW],
            templatePlotsFixture.plots,
            'group'
          )
        }
      })
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_REORDER_PLOTS_TEMPLATES,
        undefined,
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle a plot zoomed message from the webview', async () => {
      const { mockMessageReceived } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')

      mockMessageReceived.fire({
        type: MessageFromWebviewType.ZOOM_PLOT
      })

      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_ZOOM_PLOT,
        { isImage: false },
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle a plot zoomed message from the webview for an image', async () => {
      const { mockMessageReceived, webview } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })
      stub(FileSystem, 'openImageFileInEditor').resolves(true)

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')

      mockMessageReceived.fire({
        payload: webview.getWebviewUri('a/path.jpg'),
        type: MessageFromWebviewType.ZOOM_PLOT
      })

      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_ZOOM_PLOT,
        { isImage: true },
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle refresh plots message from the webview for the template plots', async () => {
      const { mockMessageReceived, messageSpy } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      messageSpy.resetHistory()
      mockMessageReceived.fire({
        payload: PlotsSection.TEMPLATE_PLOTS,
        type: MessageFromWebviewType.REFRESH_PLOTS
      })

      expect(messageSpy).to.be.calledOnce
      expect(messageSpy).to.be.calledWithExactly({
        template: templatePlotsFixture
      })
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle refresh plots message from the webview for the custom plots', async () => {
      const { mockMessageReceived, messageSpy } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      messageSpy.resetHistory()
      mockMessageReceived.fire({
        payload: PlotsSection.CUSTOM_PLOTS,
        type: MessageFromWebviewType.REFRESH_PLOTS
      })

      expect(messageSpy).to.be.calledOnce
      expect(messageSpy).to.be.calledWithExactly({
        custom: customPlotsFixture
      })
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle refresh plots message from the webview for the comparison table', async () => {
      const { mockMessageReceived, messageSpy } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      messageSpy.resetHistory()
      mockMessageReceived.fire({
        payload: PlotsSection.COMPARISON_TABLE,
        type: MessageFromWebviewType.REFRESH_PLOTS
      })

      expect(messageSpy).to.be.calledOnce
      expect(messageSpy).to.be.calledWithExactly({
        comparison: comparisonPlotsFixture
      })
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should open an image when receiving a plot zoomed message from the webview with a payload', async () => {
      const { webview, mockMessageReceived } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const imagePath = 'some/path/image.jpg'

      stub(Telemetry, 'sendTelemetryEvent')
      const mockExecuteCommands = stub(commands, 'executeCommand')

      mockMessageReceived.fire({
        payload: webview.getWebviewUri(imagePath),
        type: MessageFromWebviewType.ZOOM_PLOT
      })

      expect(mockExecuteCommands).to.be.calledWith(
        'vscode.open',
        Uri.file(imagePath)
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle an export plot data as json message from the webview', async () => {
      const { mockMessageReceived } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')
      const customPlot = customPlotsFixture.plots[0]
      const mockShowSaveDialog = stub(window, 'showSaveDialog')
      const mockWriteJson = stub(FileSystem, 'writeJson')
      const mockOpenFile = stub(FileSystem, 'openFileInEditor')
      const exportFile = Uri.file('raw-data.json')

      mockShowSaveDialog.resolves(exportFile)

      const openFileEvent = new Promise(resolve =>
        mockOpenFile.onFirstCall().callsFake(() => {
          resolve(undefined)
          return Promise.resolve(undefined as unknown as TextDocument)
        })
      )

      mockMessageReceived.fire({
        payload: customPlot.id,
        type: MessageFromWebviewType.EXPORT_PLOT_DATA_AS_JSON
      })

      const expectedOrder = [
        'exp-83425',
        'test-branch',
        'exp-e7a67',
        '7df876c',
        'fe2919b',
        'main'
      ]

      await openFileEvent

      expect(mockWriteJson).to.be.calledOnce
      expect(mockWriteJson).to.be.calledWithExactly(
        exportFile.path,
        [
          ...(customPlot.anchorDefinitions[PLOT_ANCHORS.DATA] as {
            id: string
          }[])
        ].sort(
          (a, b) => expectedOrder.indexOf(a.id) - expectedOrder.indexOf(b.id)
        ),
        true
      )
      expect(mockOpenFile).to.calledWithExactly(exportFile.path)
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_EXPORT_PLOT_DATA_AS_JSON,
        undefined,
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle an export plot as svg message from the webview', async () => {
      const { mockMessageReceived } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const mockSvg = '<svg></svg>'

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')
      const mockShowSaveDialog = stub(window, 'showSaveDialog')
      const mockWriteFile = stub(FileSystem, 'writeFile')
      const mockOpenUrl = stub(External, 'openUrl')
      const exportFile = Uri.file('visualization.svg')

      mockShowSaveDialog.resolves(exportFile)

      const openUrlEvent = new Promise(resolve =>
        mockOpenUrl.callsFake(() => {
          resolve(undefined)
          return Promise.resolve(true)
        })
      )

      mockMessageReceived.fire({
        payload: mockSvg,
        type: MessageFromWebviewType.EXPORT_PLOT_AS_SVG
      })

      await openUrlEvent

      expect(mockWriteFile).to.be.calledOnce
      expect(mockWriteFile).to.be.calledWithExactly(exportFile.path, mockSvg)
      expect(mockOpenUrl).to.calledWithExactly(exportFile.path)
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_EXPORT_PLOT_AS_SVG,
        undefined,
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle an export plot data as csv message from the webview', async () => {
      const { mockMessageReceived } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')
      const mockShowSaveDialog = stub(window, 'showSaveDialog')
      const mockWriteCsv = stub(FileSystem, 'writeCsv')
      const mockOpenFile = stub(FileSystem, 'openFileInEditor')
      const exportFile = Uri.file('raw-data.csv')
      const templatePlot = templatePlotsFixture.plots[0].entries[0]

      mockShowSaveDialog.resolves(exportFile)

      const openFileEvent = new Promise(resolve =>
        mockOpenFile.onFirstCall().callsFake(() => {
          resolve(undefined)
          return Promise.resolve(undefined as unknown as TextDocument)
        })
      )

      mockMessageReceived.fire({
        payload: templatePlot.id,
        type: MessageFromWebviewType.EXPORT_PLOT_DATA_AS_CSV
      })

      await openFileEvent

      expect(mockWriteCsv).to.be.calledOnce
      expect(mockWriteCsv).to.be.calledWithExactly(
        exportFile.path,
        templatePlot.anchorDefinitions[PLOT_ANCHORS.DATA]
      )
      expect(mockOpenFile).to.calledWithExactly(exportFile.path)
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_EXPORT_PLOT_DATA_AS_CSV,
        undefined,
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle an export plot data as tsv message from the webview', async () => {
      const { mockMessageReceived } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')
      const mockShowSaveDialog = stub(window, 'showSaveDialog')
      const mockWriteTsv = stub(FileSystem, 'writeTsv')
      const mockOpenFile = stub(FileSystem, 'openFileInEditor')
      const exportFile = Uri.file('raw-data.tsv')
      const customPlot = customPlotsFixture.plots[0]

      mockShowSaveDialog.resolves(exportFile)

      const openFileEvent = new Promise(resolve =>
        mockOpenFile.onFirstCall().callsFake(() => {
          resolve(undefined)
          return Promise.resolve(undefined as unknown as TextDocument)
        })
      )

      mockMessageReceived.fire({
        payload: customPlot.id,
        type: MessageFromWebviewType.EXPORT_PLOT_DATA_AS_TSV
      })

      await openFileEvent

      const expectedOrder = [
        'exp-83425',
        'test-branch',
        'exp-e7a67',
        '7df876c',
        'fe2919b',
        'main'
      ]

      expect(mockWriteTsv).to.be.calledOnce
      expect(mockWriteTsv).to.be.calledWithExactly(
        exportFile.path,
        [
          ...(customPlot.anchorDefinitions[PLOT_ANCHORS.DATA] as {
            id: string
          }[])
        ].sort(
          (a, b) => expectedOrder.indexOf(a.id) - expectedOrder.indexOf(b.id)
        )
      )

      expect(mockOpenFile).to.calledWithExactly(exportFile.path)
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_EXPORT_PLOT_DATA_AS_TSV,
        undefined,
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle export data messages from the webview when the file is cancelled or errors are thrown during file writing', async () => {
      const { mockMessageReceived } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')
      const mockShowSaveDialog = stub(window, 'showSaveDialog')
      const mockWriteCsv = stub(FileSystem, 'writeCsv')
      const mockOpenFile = stub(FileSystem, 'openFileInEditor')
      const exportFile = Uri.file('raw-data.csv')
      const templatePlot = templatePlotsFixture.plots[0].entries[0]

      mockShowSaveDialog.resolves(exportFile)

      const fileCancelledEvent = new Promise(resolve =>
        mockShowSaveDialog.onFirstCall().callsFake(() => {
          resolve(undefined)
          return Promise.resolve(undefined)
        })
      )

      mockMessageReceived.fire({
        payload: templatePlot.id,
        type: MessageFromWebviewType.EXPORT_PLOT_DATA_AS_CSV
      })

      await fileCancelledEvent

      expect(mockSendTelemetryEvent).not.to.be.called
      expect(mockWriteCsv).not.to.be.called
      expect(mockOpenFile).not.to.be.called

      const mockShowInformationMessage = stub(window, 'showErrorMessage')
      const fileWriteErrorEvent = new Promise(resolve =>
        mockWriteCsv.onFirstCall().callsFake(() => {
          resolve(undefined)
          throw new Error('file failed to write')
        })
      )

      mockMessageReceived.fire({
        payload: templatePlot.id,
        type: MessageFromWebviewType.EXPORT_PLOT_DATA_AS_CSV
      })

      await fileWriteErrorEvent

      expect(mockOpenFile).not.to.be.called
      expect(mockShowInformationMessage).to.be.called
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle a custom plots reordered message from the webview', async () => {
      const { plotsModel, messageSpy, mockMessageReceived } =
        await buildPlotsWebview({
          disposer: disposable,
          plotsDiff: plotsDiffFixture
        })

      const mockNewCustomPlotsOrder = [
        'custom-summary.json:accuracy-params.yaml:epochs',
        'custom-summary.json:loss-params.yaml:log_file'
      ]

      stub(plotsModel, 'getCustomPlots')
        .onFirstCall()
        .returns(customPlotsFixture)

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')
      const mockSetCustomPlotsOrder = stub(plotsModel, 'setCustomPlotsOrder')
      mockSetCustomPlotsOrder.returns(undefined)

      messageSpy.resetHistory()

      mockMessageReceived.fire({
        payload: mockNewCustomPlotsOrder,
        type: MessageFromWebviewType.REORDER_PLOTS_CUSTOM
      })

      expect(mockSetCustomPlotsOrder).to.be.calledOnce
      expect(mockSetCustomPlotsOrder).to.be.calledWithExactly([
        {
          metric: 'summary.json:accuracy',
          param: 'params.yaml:epochs'
        },
        {
          metric: 'summary.json:loss',
          param: 'params.yaml:log_file'
        }
      ])
      expect(messageSpy).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_REORDER_PLOTS_CUSTOM,
        undefined,
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle a select experiments message from the webview', async () => {
      const { experiments, mockMessageReceived } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const mockSelectExperiments = stub(
        experiments,
        'selectExperimentsToPlot'
      ).resolves(undefined)

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')

      mockMessageReceived.fire({
        type: MessageFromWebviewType.SELECT_EXPERIMENTS
      })

      expect(mockSelectExperiments).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_SELECT_EXPERIMENTS,
        undefined,
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle a select plots message from the webview', async () => {
      const { mockMessageReceived, plots } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const mockSelectExperiments = stub(plots, 'selectPlots').resolves(
        undefined
      )

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')

      mockMessageReceived.fire({
        type: MessageFromWebviewType.SELECT_PLOTS
      })

      expect(mockSelectExperiments).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_SELECT_PLOTS,
        undefined,
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle a message to manually refresh plot revisions from the webview', async () => {
      const mockNow = getMockNow()
      const { messageSpy, mockMessageReceived, mockPlotsDiff } =
        await buildPlotsWebview({
          disposer: disposable,
          plotsDiff: plotsDiffFixture
        })
      messageSpy.resetHistory()

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')

      const messageSent = waitForSpyCall(messageSpy, messageSpy.callCount)

      bypassProcessManagerDebounce(mockNow)

      mockMessageReceived.fire({
        type: MessageFromWebviewType.REFRESH_REVISIONS
      })

      await messageSent

      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWith(EventName.PLOTS_REFRESH)
      expect(mockPlotsDiff).to.be.called
      expect(mockPlotsDiff).to.be.calledWithExactly(
        dvcDemoPath,
        REVISIONS[0],
        REVISIONS[2],
        REVISIONS[3],
        REVISIONS[4],
        REVISIONS[1]
      )
      expect(
        messageSpy,
        'should call the plots webview with cached data before refreshing with data from the CLI'
      ).to.be.calledTwice
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should be able to make the plots webview visible', async () => {
      const { messageSpy, mockPlotsDiff, webview } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      expect(mockPlotsDiff).to.be.called

      const {
        comparison: comparisonData,
        custom: customData,
        sectionCollapsed,
        template: templateData,
        selectedRevisions: selectedRevisionsData
      } = getFirstArgOfLastCall(messageSpy)

      expect(comparisonData).to.deep.equal(comparisonPlotsFixture)
      expect(customData).to.deep.equal(customPlotsFixture)
      expect(sectionCollapsed).to.deep.equal(DEFAULT_SECTION_COLLAPSED)
      expect(templateData).to.deep.equal(templatePlotsFixture)
      expect(selectedRevisionsData).to.deep.equal(plotsRevisionsFixture)

      const expectedPlotsData: TPlotsData = {
        cliError: null,
        comparison: comparisonPlotsFixture,
        custom: customPlotsFixture,
        hasPlots: true,
        hasUnselectedPlots: false,
        sectionCollapsed: DEFAULT_SECTION_COLLAPSED,
        selectedRevisions: plotsRevisionsFixture,
        template: templatePlotsFixture
      }

      expect(messageSpy).to.be.calledWithMatch(expectedPlotsData)

      expect(webview.isActive()).to.be.true
      expect(webview.isVisible()).to.be.true
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it("should remove a revision's data if the revision is re-fetched and now contains an error", async () => {
      const accPngPath = join('plots', 'acc.png')
      const accPng = [
        ...plotsDiffFixture.data[join('plots', 'acc.png')]
      ] as ImagePlot[]
      const lossTsvPath = join('logs', 'loss.tsv')
      const lossTsv = [
        ...plotsDiffFixture.data[lossTsvPath]
      ] as TemplatePlotOutput[]

      const plotsDiffOutput = {
        data: {
          [accPngPath]: accPng,
          [lossTsvPath]: lossTsv
        }
      }

      const brokenExp = REVISIONS[2]

      const reFetchedOutput = {
        data: {
          [accPngPath]: accPng.filter(
            ({ revisions }) => !isEqual(revisions, [brokenExp])
          ),
          [lossTsvPath]: lossTsv.map((plot, i) => {
            const anchor_definitions = { ...lossTsv[i].anchor_definitions }
            anchor_definitions[PLOT_ANCHORS.DATA] =
              anchor_definitions[PLOT_ANCHORS.DATA]?.filter(
                ({ rev }) => rev !== brokenExp
              ) || []

            return {
              ...plot,
              anchor_definitions,
              revisions: lossTsv[i].revisions?.filter(rev => rev !== brokenExp)
            }
          })
        }
      }

      const { mockPlotsDiff, plots, data, plotsModel } = await buildPlots({
        disposer: disposable,
        plotsDiff: plotsDiffOutput
      })

      await plots.isReady()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getExistingRevisions = (plotsModel: any) =>
        uniqueValues([
          ...Object.keys(plotsModel.revisionData),
          ...Object.keys(plotsModel.comparisonData)
        ])

      expect(getExistingRevisions(plotsModel)).to.contain(brokenExp)

      mockPlotsDiff.resetBehavior()
      mockPlotsDiff.resolves(reFetchedOutput)

      const dataUpdated = new Promise(resolve =>
        data.onDidUpdate(() => resolve(undefined))
      )

      await data.update()
      await dataUpdated

      expect(
        getExistingRevisions(plotsModel),
        'the revision should not exist in the underlying data'
      ).not.to.contain(brokenExp)
    })

    it('should send plot errors to the webview', async () => {
      const accPngPath = join('plots', 'acc.png')
      const accPng = [
        ...plotsDiffFixture.data[join('plots', 'acc.png')]
      ] as ImagePlot[]
      const lossTsvPath = join('logs', 'loss.tsv')
      const lossTsv = [
        ...plotsDiffFixture.data[lossTsvPath]
      ] as TemplatePlotOutput[]

      const plotsDiffOutput = {
        data: {
          [accPngPath]: accPng,
          [lossTsvPath]: lossTsv
        },
        errors: [
          {
            msg: 'File not found',
            name: accPngPath,
            rev: 'workspace',
            type: 'FileNotFoundError'
          },
          {
            msg: 'Could not find provided field',
            name: lossTsvPath,
            rev: 'workspace',
            type: 'FieldNotFoundError'
          },
          {
            msg: 'Could not find provided field',
            name: lossTsvPath,
            rev: 'main',
            type: 'FieldNotFoundError'
          }
        ]
      }
      const { messageSpy } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffOutput
      })

      const expectedPlotsData: TPlotsData = {
        plotErrors: [
          {
            path: accPngPath,
            revs: [{ msg: 'File not found', rev: 'workspace' }]
          },
          {
            path: lossTsvPath,
            revs: [
              { msg: 'Could not find provided field', rev: 'workspace' },
              { msg: 'Could not find provided field', rev: 'main' }
            ]
          }
        ]
      }

      expect(messageSpy).to.be.calledWithMatch(expectedPlotsData)
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle a toggle experiment message from the webview', async () => {
      const { experiments, mockMessageReceived } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const mockSelectExperiments = stub(
        experiments,
        'toggleExperimentStatus'
      ).resolves(undefined)

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')

      mockMessageReceived.fire({
        payload: 'main',
        type: MessageFromWebviewType.TOGGLE_EXPERIMENT
      })

      expect(mockSelectExperiments).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledOnce
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_EXPERIMENT_TOGGLE,
        undefined,
        undefined
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle a remove custom plot message from the webview', async () => {
      const { mockMessageReceived } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const executeCommandSpy = spy(commands, 'executeCommand')

      mockMessageReceived.fire({
        type: MessageFromWebviewType.REMOVE_CUSTOM_PLOTS
      })

      expect(executeCommandSpy).to.be.calledWithExactly(
        RegisteredCommands.PLOTS_CUSTOM_REMOVE,
        dvcDemoPath
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle an update smooth plot values message from the webview', async () => {
      const { mockMessageReceived, plotsModel } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })
      const templatePlot = templatePlotsFixture.plots[0].entries[0]

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')
      const mockSetSmoothPlotValues = stub(plotsModel, 'setSmoothPlotValues')

      mockMessageReceived.fire({
        payload: {
          id: templatePlot.id,
          value: 0.5
        },
        type: MessageFromWebviewType.SET_SMOOTH_PLOT_VALUE
      })

      expect(mockSendTelemetryEvent).to.be.called
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_SET_SMOOTH_PLOT_VALUE,
        undefined,
        undefined
      )
      expect(mockSetSmoothPlotValues).to.be.called
      expect(mockSetSmoothPlotValues).to.be.calledWithExactly(
        templatePlot.id,
        0.5
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle an update comparison multi plot value message from the webview', async () => {
      const { mockMessageReceived, plotsModel } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })
      const multiImg = comparisonPlotsFixture.plots[3]

      const mockSendTelemetryEvent = stub(Telemetry, 'sendTelemetryEvent')
      const mockSetComparisonMultiPlotValue = stub(
        plotsModel,
        'setComparisonMultiPlotValue'
      )

      mockMessageReceived.fire({
        payload: {
          path: multiImg.path,
          revision: 'main',
          value: 5
        },
        type: MessageFromWebviewType.SET_COMPARISON_MULTI_PLOT_VALUE
      })

      expect(mockSendTelemetryEvent).to.be.called
      expect(mockSendTelemetryEvent).to.be.calledWithExactly(
        EventName.VIEWS_PLOTS_SET_COMPARISON_MULTI_PLOT_VALUE,
        undefined,
        undefined
      )
      expect(mockSetComparisonMultiPlotValue).to.be.called
      expect(mockSetComparisonMultiPlotValue).to.be.calledWithExactly(
        'main',
        multiImg.path,
        5
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle an add plot message from the webview', async () => {
      const { mockMessageReceived } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })

      const mockExecuteCommand = stub(commands, 'executeCommand')

      mockMessageReceived.fire({
        type: MessageFromWebviewType.ADD_PLOT
      })

      expect(mockExecuteCommand).to.be.calledWithExactly(
        RegisteredCommands.ADD_PLOT,
        dvcDemoPath
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)

    it('should handle the CLI throwing an error', async () => {
      const { data, errorsModel, mockPlotsDiff, plots, plotsModel } =
        await buildPlots({ disposer: disposable, plotsDiff: plotsDiffFixture })

      const mockErrorMsg = `'./dvc.yaml' is invalid.\n
    While parsing a flow sequence, in line 5, column 9
      5 │   │   [training/plots/metrics/train/acc.tsv: acc\n
    Did not find expected ',' or ']', in line 6, column 44
      6 │   │   training/plots/metrics/test/acc.tsv: acc]`

      await plots.isReady()

      mockPlotsDiff.resetBehavior()
      mockPlotsDiff.resolves({
        error: { msg: mockErrorMsg, type: 'caught error' }
      })

      await data.update()

      const errorItems = plots.getChildPaths(undefined) as ErrorItem[]

      expect(
        errorItems,
        'should return a single error item for the plots path tree'
      ).to.deep.equal([
        {
          error: mockErrorMsg,
          path: join(dvcDemoPath, './dvc.yaml is invalid.')
        }
      ])

      expect(
        errorsModel.getErrorPaths(plotsModel.getSelectedRevisionIds(), []),
        'should return the correct path to give the item a DecorationError'
      ).to.deep.equal(new Set([errorItems[0].path]))

      mockPlotsDiff.resetBehavior()
      mockPlotsDiff.resolves(plotsDiffFixture)

      await data.update()

      const selectionItems = plots.getChildPaths(undefined) as unknown[]

      expect(
        selectionItems.filter(item => isErrorItem(item)),
        'should not return any error items after the error is resolved'
      ).to.deep.equal([])

      expect(
        errorsModel.getErrorPaths(plotsModel.getSelectedRevisionIds(), []),
        'should no long provide decorations to the plots paths tree'
      ).to.deep.equal(new Set([]))
    })

    it('should set has custom selection to true when calling selectPlots', async () => {
      const { plots, pathsModel } = await buildPlotsWebview({
        disposer: disposable,
        plotsDiff: plotsDiffFixture
      })
      const mockSetCustomSelection = stub(pathsModel, 'setHasCustomSelection')
      stub(pathsModel, 'setTemplateOrder')
      stub(pathsModel, 'toggleStatus')
      const terminalNodes = Array.from({ length: 32 }, i => ({
        path: i
      })) as unknown as (PlotPath & {
        selected: boolean
      })[]
      stub(pathsModel, 'getTerminalNodes').returns(terminalNodes)

      plots.togglePathStatus(dvcDemoPath)

      expect(mockSetCustomSelection).to.be.calledWith(true)
    }).timeout(WEBVIEW_TEST_TIMEOUT)
  })
})
