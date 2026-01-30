import { join } from 'dvc/src/test/util/path'
import { configureStore } from '@reduxjs/toolkit'
import React from 'react'
import { Provider } from 'react-redux'
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import '@testing-library/jest-dom'
import comparisonTableFixture from 'dvc/src/test/fixtures/plotsDiff/comparison'
import customPlotsFixture from 'dvc/src/test/fixtures/expShow/base/customPlots'
import plotsRevisionsFixture from 'dvc/src/test/fixtures/plotsDiff/revisions'
import templatePlotsFixture from 'dvc/src/test/fixtures/plotsDiff/template/webview'
import manyTemplatePlots from 'dvc/src/test/fixtures/plotsDiff/template/virtualization'
import {
  DEFAULT_SECTION_COLLAPSED,
  PlotsData,
  Revision,
  PlotsSection,
  TemplatePlotGroup,
  TemplatePlotsData,
  CustomPlotsData,
  DEFAULT_PLOT_HEIGHT,
  DEFAULT_NB_ITEMS_PER_ROW
} from 'dvc/src/plots/webview/contract'
import {
  MessageFromWebviewType,
  MessageToWebviewType
} from 'dvc/src/webview/contract'
import { App } from './App'
import { NewSectionBlock } from './templatePlots/TemplatePlots'
import {
  CustomPlotsById,
  plotDataStore,
  TemplatePlotsById
} from './plotDataStore'
import { setMaxNbPlotsPerRow } from './webviewSlice'
import {
  templatePlotsInitialState,
  toggleDragAndDropMode as toggleTemplatePlotsDragAndDropMode
} from './templatePlots/templatePlotsSlice'
import {
  customPlotsInitialState,
  toggleDragAndDropMode as toggleCustomPlotsDragAndDropMode
} from './customPlots/customPlotsSlice'
import { comparisonTableInitialState } from './comparisonTable/comparisonTableSlice'
import { plotsReducers, plotsStore } from '../store'
import { vsCodeApi } from '../../shared/api'
import {
  createBubbledEvent,
  dragAndDrop,
  dragEnter,
  dragLeave
} from '../../test/dragDrop'
import { SectionDescriptionMainText } from '../../shared/components/sectionContainer/SectionDescription'
import { DragEnterDirection } from '../../shared/components/dragDrop/util'
import { clearSelection, createWindowTextSelection } from '../../test/selection'
import * as EventCurrentTargetDistances from '../../shared/components/dragDrop/currentTarget'
import { OVERSCAN_ROW_COUNT } from '../../shared/components/virtualizedGrid/VirtualizedGrid'

jest.mock('../../shared/components/dragDrop/currentTarget', () => {
  const actualModule = jest.requireActual(
    '../../shared/components/dragDrop/currentTarget'
  )
  return {
    __esModule: true,
    ...actualModule
  }
})

jest.mock('../../shared/api')

jest.spyOn(console, 'warn').mockImplementation(() => {})

const { postMessage } = vsCodeApi
const mockPostMessage = jest.mocked(postMessage)

const heightToSuppressVegaError = 1000
const originalOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight'
)?.value
const originalOffsetWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetWidth'
)?.value

describe('App', () => {
  const sendSetDataMessage = (data: PlotsData) => {
    const message = new MessageEvent('message', {
      data: {
        data,
        type: MessageToWebviewType.SET_DATA
      }
    })
    fireEvent(window, message)
  }

  const renderAppWithOptionalData = (data?: PlotsData) => {
    const store = configureStore({ reducer: { ...plotsReducers } })

    render(
      <Provider store={store}>
        <App />
      </Provider>
    )
    data && sendSetDataMessage(data)

    return store
  }

  const setWrapperSize = (store: typeof plotsStore, size = 2000) =>
    act(() => {
      store.dispatch(setMaxNbPlotsPerRow(size))
    })

  const templatePlot = templatePlotsFixture.plots[0].entries[0]
  const complexTemplatePlotsFixture = {
    ...templatePlotsFixture,
    plots: [
      {
        entries: [
          ...templatePlotsFixture.plots[0].entries,
          { ...templatePlot, id: join('other', 'plot.tsv') }
        ],
        group: TemplatePlotGroup.SINGLE_VIEW
      },
      {
        entries: [{ ...templatePlot, id: join('other', 'multiview.tsv') }],
        group: TemplatePlotGroup.MULTI_VIEW
      }
    ]
  } as TemplatePlotsData

  const renderAppAndChangeSize = async (
    data: PlotsData,
    nbItemsPerRow: number,
    section: PlotsSection
  ) => {
    const withSize = {
      nbItemsPerRow
    }
    const plotsData = {
      ...data,
      sectionCollapsed: DEFAULT_SECTION_COLLAPSED
    }
    if (section === PlotsSection.CUSTOM_PLOTS) {
      plotsData.custom = {
        ...data?.custom,
        ...withSize
      } as CustomPlotsData
    }
    if (section === PlotsSection.TEMPLATE_PLOTS) {
      plotsData.template = {
        ...data?.template,
        ...withSize
      } as TemplatePlotsData
    }

    const store = renderAppWithOptionalData(plotsData)
    await screen.findAllByTestId('plots-wrapper')

    return store
  }

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      value: 50
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      value: 50
    })
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockImplementation(() => heightToSuppressVegaError)
    plotDataStore[PlotsSection.CUSTOM_PLOTS] = {} as CustomPlotsById
    plotDataStore[PlotsSection.TEMPLATE_PLOTS] = {} as TemplatePlotsById
  })

  afterAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      value: originalOffsetHeight
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      value: originalOffsetWidth
    })
  })

  it('should send the initialized message on first render', () => {
    renderAppWithOptionalData()
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.INITIALIZED
    })
    expect(mockPostMessage).toHaveBeenCalledTimes(1)
  })

  it('should render the loading state when given no data', async () => {
    renderAppWithOptionalData()
    const loadingState = await screen.findByText('Loading Plots...')

    expect(loadingState).toBeInTheDocument()
  })

  it('should render the empty state when given data with no plots', async () => {
    renderAppWithOptionalData({ custom: null })
    const emptyState = await screen.findByText('No Plots Detected.')

    expect(emptyState).toBeInTheDocument()
  })

  it('should render loading section states when given a single revision which has not been fetched', async () => {
    renderAppWithOptionalData({
      comparison: {
        height: DEFAULT_PLOT_HEIGHT,
        multiPlotValues: {},
        plots: [
          {
            path: 'training/plots/images/misclassified.jpg',
            revisions: {
              ad2b5ec: {
                id: 'ad2b5ec',
                imgs: [
                  {
                    errors: undefined,
                    loading: true,
                    url: undefined
                  }
                ]
              }
            }
          }
        ],
        revisions: [
          {
            description: '[exp-a270a]',
            displayColor: '#945dd6',
            fetched: false,
            id: 'ad2b5ec',
            label: 'ad2b5ec',
            summaryColumns: []
          }
        ],
        width: DEFAULT_NB_ITEMS_PER_ROW
      },
      custom: null,
      hasPlots: true,
      hasUnselectedPlots: false,
      sectionCollapsed: DEFAULT_SECTION_COLLAPSED,
      selectedRevisions: [
        {
          description: '[exp-a270a]',
          displayColor: '#945dd6',
          fetched: false,
          id: 'ad2b5ec',
          label: 'ad2b5ec',
          summaryColumns: []
        }
      ],
      template: null
    })
    const loading = await screen.findAllByText('Loading...')

    expect(loading).toHaveLength(3)
  })

  it('should render loading section states with multi image plots when given a single revision which has not been fetched', async () => {
    renderAppWithOptionalData({
      comparison: {
        height: DEFAULT_PLOT_HEIGHT,
        multiPlotValues: {},
        plots: [
          {
            path: 'training/plots/images/image',
            revisions: {
              ad2b5ec: {
                id: 'ad2b5ec',
                imgs: [
                  {
                    errors: undefined,
                    loading: true,
                    url: undefined
                  },
                  {
                    errors: undefined,
                    loading: true,
                    url: undefined
                  },
                  {
                    errors: undefined,
                    loading: true,
                    url: undefined
                  }
                ]
              }
            }
          }
        ],
        revisions: [
          {
            description: '[exp-a270a]',
            displayColor: '#945dd6',
            fetched: false,
            id: 'ad2b5ec',
            label: 'ad2b5ec',
            summaryColumns: []
          }
        ],
        width: DEFAULT_NB_ITEMS_PER_ROW
      },
      custom: null,
      hasPlots: true,
      hasUnselectedPlots: false,
      sectionCollapsed: DEFAULT_SECTION_COLLAPSED,
      selectedRevisions: [
        {
          description: '[exp-a270a]',
          displayColor: '#945dd6',
          fetched: false,
          id: 'ad2b5ec',
          label: 'ad2b5ec',
          summaryColumns: []
        }
      ],
      template: null
    })
    const loading = await screen.findAllByText('Loading...')

    expect(loading).toHaveLength(3)
  })

  it('should render only get started (buttons: select plots, add experiments, add plot) when there are some selected exps, all unselected plots, and no custom plots', async () => {
    renderAppWithOptionalData({
      hasPlots: true,
      hasUnselectedPlots: true,
      selectedRevisions: [{} as Revision]
    })
    const addExperimentsButton = await screen.findByText('Add Experiments')
    const selectPlotsButton = await screen.findByText('Select Plots')
    const addPlotsButton = await screen.findByText('Add Plot')

    expect(addExperimentsButton).toBeInTheDocument()
    expect(selectPlotsButton).toBeInTheDocument()
    expect(addPlotsButton).toBeInTheDocument()
    expect(screen.queryByTestId('section-container')).not.toBeInTheDocument()

    mockPostMessage.mockReset()

    fireEvent.click(addExperimentsButton)

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.SELECT_EXPERIMENTS
    })

    mockPostMessage.mockReset()

    fireEvent.click(selectPlotsButton)

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.SELECT_PLOTS
    })
    mockPostMessage.mockReset()

    fireEvent.click(addPlotsButton)

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.ADD_PLOT
    })
    mockPostMessage.mockReset()
  })

  it('should render only get started (buttons: add experiments, add custom plots) when there is a cli error', async () => {
    const cliError = 'this is an error thrown by DVC'

    renderAppWithOptionalData({
      cliError,
      hasPlots: false,
      hasUnselectedPlots: false,
      selectedRevisions: [{} as Revision]
    })
    const addExperimentsButton = await screen.findByText('Add Experiments')
    const addCustomPlotsButton = await screen.findByText('Add Custom Plot')
    const errorIcon = await screen.findByTestId('error-icon')
    const refreshButton = await screen.findByText('Refresh')

    expect(addExperimentsButton).toBeInTheDocument()
    expect(screen.queryByText('Add Plot')).not.toBeInTheDocument()
    expect(addCustomPlotsButton).toBeInTheDocument()
    expect(errorIcon).toBeInTheDocument()
    expect(screen.queryByTestId('section-container')).not.toBeInTheDocument()

    mockPostMessage.mockReset()

    fireEvent.click(addExperimentsButton)

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.SELECT_EXPERIMENTS
    })

    mockPostMessage.mockReset()

    fireEvent.mouseEnter(errorIcon, { bubbles: true, cancelable: true })

    const error = await screen.findByText(cliError)

    expect(error).toBeInTheDocument()

    fireEvent.click(addCustomPlotsButton)

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.ADD_PLOT
    })
    mockPostMessage.mockReset()

    fireEvent.click(refreshButton)

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.REFRESH_REVISIONS
    })
    mockPostMessage.mockReset()
  })

  it('should render get started (buttons: select plots, add experiments, add plot) and custom section when there are some selected exps, all unselected plots, and added custom plots', async () => {
    renderAppWithOptionalData({
      custom: customPlotsFixture,
      hasPlots: true,
      hasUnselectedPlots: true,
      selectedRevisions: [{} as Revision]
    })
    const addExperimentsButton = await screen.findByText('Add Experiments')
    const selectPlotsButton = await screen.findByText('Select Plots')
    const addPlotButton = await screen.findByText('Add Plot')
    const customSection = await screen.findByTestId('section-container')

    expect(addExperimentsButton).toBeInTheDocument()
    expect(selectPlotsButton).toBeInTheDocument()
    expect(addPlotButton).toBeInTheDocument()
    expect(customSection).toBeInTheDocument()

    mockPostMessage.mockReset()

    fireEvent.click(addExperimentsButton)

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.SELECT_EXPERIMENTS
    })

    mockPostMessage.mockReset()

    fireEvent.click(selectPlotsButton)

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.SELECT_PLOTS
    })
    mockPostMessage.mockReset()

    fireEvent.click(addPlotButton)

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.ADD_PLOT
    })
  })

  it('should render only get started (buttons: add experiments, add plot) when there are no selected exps and no custom plots', async () => {
    renderAppWithOptionalData({
      custom: null,
      hasPlots: true,
      hasUnselectedPlots: false,
      selectedRevisions: undefined
    })
    const addExperimentsButton = await screen.findByText('Add Experiments')
    const addPlotButton = await screen.findByText('Add Plot')
    const customSection = screen.queryByTestId('section-container')

    expect(addExperimentsButton).toBeInTheDocument()
    expect(addPlotButton).toBeInTheDocument()
    expect(customSection).not.toBeInTheDocument()

    mockPostMessage.mockReset()

    fireEvent.click(addExperimentsButton)
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.SELECT_EXPERIMENTS
    })

    fireEvent.click(addPlotButton)

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.ADD_PLOT
    })
    mockPostMessage.mockReset()
  })

  it('should render get started (buttons: add experiments, add plots) and custom section when there are no selected exps and added custom plots', async () => {
    renderAppWithOptionalData({
      custom: customPlotsFixture,
      hasPlots: true,
      hasUnselectedPlots: false,
      selectedRevisions: undefined
    })
    const addExperimentsButton = await screen.findByText('Add Experiments')
    const addPlotsButton = await screen.findByText('Add Plot')
    const customSection = await screen.findByTestId('section-container')

    expect(addExperimentsButton).toBeInTheDocument()
    expect(addPlotsButton).toBeInTheDocument()
    expect(customSection).toBeInTheDocument()

    mockPostMessage.mockReset()

    fireEvent.click(addExperimentsButton)
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.SELECT_EXPERIMENTS
    })

    mockPostMessage.mockReset()

    fireEvent.click(addPlotsButton)
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.ADD_PLOT
    })
  })

  it('should render custom with "No Plots to Display" message when there is no custom plots data', () => {
    renderAppWithOptionalData({
      template: templatePlotsFixture
    })

    expect(screen.queryByText('Loading Plots...')).not.toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
    expect(screen.getByText('No Plots to Display')).toBeInTheDocument()
  })

  it('should render custom with "No Plots Added" message and "Add Plot" button when there are no plots added', () => {
    renderAppWithOptionalData({
      custom: {
        ...customPlotsFixture,
        hasAddedPlots: false,
        plots: []
      },
      template: templatePlotsFixture
    })

    expect(screen.queryByText('Loading Plots...')).not.toBeInTheDocument()
    expect(screen.queryByText('No Plots to Display')).not.toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
    expect(screen.getByText('No Plots Added')).toBeInTheDocument()
    const customSection = screen.getByTestId('custom-plots-section-details')

    const addPlotButton = within(customSection).getByText('Add Plot')

    expect(addPlotButton).toBeInTheDocument()

    fireEvent.click(addPlotButton)
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.ADD_PLOT
    })
  })

  it('should render custom with "No Data to Plot" message when there are added plots but no unfiltered experiments', () => {
    renderAppWithOptionalData({
      custom: {
        ...customPlotsFixture,
        hasUnfilteredExperiments: false,
        plots: []
      },
      template: templatePlotsFixture
    })

    expect(screen.queryByText('Loading Plots...')).not.toBeInTheDocument()
    expect(screen.queryByText('No Plots to Display')).not.toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
    expect(screen.getByText('No Data to Plot')).toBeInTheDocument()
  })

  it('should render template with "No Plots or Data to Display" message and "Add Plot" button if there is no template data and no unselected plots', () => {
    renderAppWithOptionalData({
      comparison: comparisonTableFixture,
      custom: customPlotsFixture,
      hasUnselectedPlots: false,
      template: null
    })

    expect(screen.queryByText('Loading Plots...')).not.toBeInTheDocument()
    expect(screen.getByText('No Plots or Data to Display')).toBeInTheDocument()

    const templateSection = screen.getByTestId('template-plots-section-details')

    const addPlotButton = within(templateSection).getByText('Add Plot')
    const selectPlotsButton =
      within(templateSection).queryByText('Select Plots')

    expect(selectPlotsButton).not.toBeInTheDocument()
    expect(addPlotButton).toBeInTheDocument()

    fireEvent.click(addPlotButton)
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.ADD_PLOT
    })
  })

  it('should render template with "No Plots or Data to Display" message and action buttons ("Select Plots" and "Add Plot") if there is no template data and unselected plots', () => {
    renderAppWithOptionalData({
      comparison: comparisonTableFixture,
      custom: customPlotsFixture,
      hasUnselectedPlots: true,
      template: null
    })

    expect(screen.queryByText('Loading Plots...')).not.toBeInTheDocument()
    expect(screen.getByText('No Plots or Data to Display')).toBeInTheDocument()

    const templateSection = screen.getByTestId('template-plots-section-details')
    const selectPlotsButton = within(templateSection).getByText('Select Plots')
    const addPlotButton = within(templateSection).getByText('Add Plot')

    expect(selectPlotsButton).toBeInTheDocument()
    fireEvent.click(selectPlotsButton)
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.SELECT_PLOTS
    })

    mockPostMessage.mockReset()

    expect(addPlotButton).toBeInTheDocument()
    fireEvent.click(addPlotButton)
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.ADD_PLOT
    })
  })

  it('should render the comparison table when given a message with comparison plots data', () => {
    const expectedSectionName = 'Images'

    renderAppWithOptionalData({
      custom: customPlotsFixture
    })

    sendSetDataMessage({
      comparison: comparisonTableFixture
    })

    expect(screen.getByText(expectedSectionName)).toBeInTheDocument()
  })

  it('should remove image plots given a message showing image plots as null', async () => {
    const emptyStateText = 'No Images to Compare'

    renderAppWithOptionalData({
      comparison: comparisonTableFixture,
      template: templatePlotsFixture
    })

    expect(screen.queryByText(emptyStateText)).not.toBeInTheDocument()

    sendSetDataMessage({
      comparison: null
    })

    const emptyState = await screen.findByText(emptyStateText)

    expect(emptyState).toBeInTheDocument()
  })

  it('should remove custom plots given a message showing custom plots as null', () => {
    renderAppWithOptionalData({
      custom: customPlotsFixture
    })

    expect(screen.getByText('Custom')).toBeInTheDocument()

    sendSetDataMessage({
      custom: null
    })

    expect(screen.queryByText('Custom')).not.toBeInTheDocument()
  })

  it('should remove all sections from the document if there is no data provided', () => {
    renderAppWithOptionalData({
      comparison: comparisonTableFixture
    })

    expect(screen.getByText('Images')).toBeInTheDocument()

    sendSetDataMessage({
      comparison: null
    })

    expect(screen.queryByText('Images')).not.toBeInTheDocument()
  })

  it('should not toggle the custom plots section when its header is clicked and its title is selected', async () => {
    renderAppWithOptionalData({
      custom: customPlotsFixture
    })

    const summaryElement = await screen.findByText('Custom')

    createWindowTextSelection('Custom', 2)
    fireEvent.click(summaryElement, {
      bubbles: true,
      cancelable: true
    })

    expect(mockPostMessage).not.toHaveBeenCalledWith({
      payload: { [PlotsSection.CUSTOM_PLOTS]: true },
      type: MessageFromWebviewType.TOGGLE_PLOTS_SECTION
    })

    clearSelection()
    fireEvent.click(summaryElement, {
      bubbles: true,
      cancelable: true
    })

    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: { [PlotsSection.CUSTOM_PLOTS]: true },
      type: MessageFromWebviewType.TOGGLE_PLOTS_SECTION
    })
  })

  it('should not toggle the comparison plots section if the tooltip is clicked', () => {
    renderAppWithOptionalData({
      comparison: comparisonTableFixture
    })

    const comparisonTooltipToggle = screen.getAllByTestId(
      'info-tooltip-toggle'
    )[1]
    fireEvent.mouseEnter(comparisonTooltipToggle, {
      bubbles: true,
      cancelable: true
    })

    const tooltip = screen.getByTestId('tooltip-comparison-plots')
    const tooltipLink = within(tooltip).getByRole('link')
    fireEvent.click(tooltipLink, {
      bubbles: true,
      cancelable: true
    })

    expect(mockPostMessage).not.toHaveBeenCalledWith({
      payload: { [PlotsSection.CUSTOM_PLOTS]: true },
      type: MessageFromWebviewType.TOGGLE_PLOTS_SECTION
    })

    fireEvent.click(comparisonTooltipToggle, {
      bubbles: true,
      cancelable: true
    })

    expect(mockPostMessage).not.toHaveBeenCalledWith({
      payload: { [PlotsSection.CUSTOM_PLOTS]: true },
      type: MessageFromWebviewType.TOGGLE_PLOTS_SECTION
    })
  })

  it('should not toggle the custom plots section when its header is clicked and the content of its tooltip is selected', async () => {
    renderAppWithOptionalData({
      custom: customPlotsFixture
    })

    const summaryElement = await screen.findByText('Custom')
    createWindowTextSelection(
      // eslint-disable-next-line testing-library/no-node-access
      SectionDescriptionMainText['custom-plots'].props.children,
      2
    )
    fireEvent.click(summaryElement, {
      bubbles: true,
      cancelable: true
    })

    expect(mockPostMessage).not.toHaveBeenCalledWith({
      payload: { [PlotsSection.CUSTOM_PLOTS]: true },
      type: MessageFromWebviewType.TOGGLE_PLOTS_SECTION
    })

    clearSelection()
    fireEvent.click(summaryElement, {
      bubbles: true,
      cancelable: true
    })

    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: { [PlotsSection.CUSTOM_PLOTS]: true },
      type: MessageFromWebviewType.TOGGLE_PLOTS_SECTION
    })
  })

  it('should toggle the custom plots section on Enter key press', async () => {
    renderAppWithOptionalData({
      custom: customPlotsFixture
    })
    const summaryElement = await screen.findByText('Custom')

    fireEvent.keyDown(summaryElement, {
      key: 'Enter'
    })

    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: { [PlotsSection.CUSTOM_PLOTS]: true },
      type: MessageFromWebviewType.TOGGLE_PLOTS_SECTION
    })
  })

  it('should clear the template plots state when closing the section', () => {
    const store = renderAppWithOptionalData({
      template: templatePlotsFixture
    })

    const toggle = within(
      screen.getByTestId(`${PlotsSection.TEMPLATE_PLOTS}-section-details`)
    ).getAllByRole('button')[0]
    fireEvent.click(toggle)

    expect(store.getState().template).toMatchObject(templatePlotsInitialState)
  })

  it('should clear the custom plots state when closing the section', () => {
    const store = renderAppWithOptionalData({
      custom: customPlotsFixture
    })

    const toggle = within(
      screen.getByTestId(`${PlotsSection.CUSTOM_PLOTS}-section-details`)
    ).getAllByRole('button')[0]
    fireEvent.click(toggle)

    expect(store.getState().custom).toMatchObject(customPlotsInitialState)
  })

  it('should clear the comparison table state when closing the section', () => {
    const store = renderAppWithOptionalData({
      comparison: comparisonTableFixture
    })

    const toggle = within(
      screen.getByTestId(`${PlotsSection.COMPARISON_TABLE}-section-details`)
    ).getAllByRole('button')[0]
    fireEvent.click(toggle)

    expect(store.getState().comparison).toMatchObject(
      comparisonTableInitialState
    )
  })

  it('should send a message to refresh the template plots when closing the section', () => {
    renderAppWithOptionalData({
      template: templatePlotsFixture
    })

    const toggle = within(
      screen.getByTestId(`${PlotsSection.TEMPLATE_PLOTS}-section-details`)
    ).getAllByRole('button')[0]
    fireEvent.click(toggle)

    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: PlotsSection.TEMPLATE_PLOTS,
      type: MessageFromWebviewType.REFRESH_PLOTS
    })
  })

  it('should send a message to refresh the custom plots when closing the section', () => {
    renderAppWithOptionalData({
      custom: customPlotsFixture
    })

    const toggle = within(
      screen.getByTestId(`${PlotsSection.CUSTOM_PLOTS}-section-details`)
    ).getAllByRole('button')[0]
    fireEvent.click(toggle)

    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: PlotsSection.CUSTOM_PLOTS,
      type: MessageFromWebviewType.REFRESH_PLOTS
    })
  })

  it('should send a message to refresh the comparison table when closing the section', () => {
    renderAppWithOptionalData({
      comparison: comparisonTableFixture
    })

    const toggle = within(
      screen.getByTestId(`${PlotsSection.COMPARISON_TABLE}-section-details`)
    ).getAllByRole('button')[0]
    fireEvent.click(toggle)

    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: PlotsSection.COMPARISON_TABLE,
      type: MessageFromWebviewType.REFRESH_PLOTS
    })
  })

  it('should display a slider to pick the number of items per row if there are items and the action is available', () => {
    const store = renderAppWithOptionalData({
      custom: customPlotsFixture
    })
    setWrapperSize(store)

    expect(screen.getByTestId('size-sliders')).toBeInTheDocument()
  })

  it('should not display a slider to pick the number of items per row if there are no items', () => {
    const store = renderAppWithOptionalData({})
    setWrapperSize(store)

    expect(screen.queryByTestId('size-sliders')).not.toBeInTheDocument()
  })

  it('should not display a slider to pick the number of items per row if the only width available for one item per row or less', () => {
    const store = renderAppWithOptionalData({
      custom: customPlotsFixture
    })
    setWrapperSize(store, 400)

    expect(screen.queryByTestId('size-sliders')).not.toBeInTheDocument()
  })

  it('should display both size sliders for template plots', () => {
    const store = renderAppWithOptionalData({
      template: templatePlotsFixture
    })
    setWrapperSize(store)

    const plotResizers = within(
      screen.getByTestId('size-sliders')
    ).getAllByRole('slider')

    expect(plotResizers.length).toBe(2)
  })

  it('should display both size sliders for custom plots', () => {
    const store = renderAppWithOptionalData({
      custom: customPlotsFixture
    })
    setWrapperSize(store)

    const plotResizers = within(
      screen.getByTestId('size-sliders')
    ).getAllByRole('slider')

    expect(plotResizers.length).toBe(2)
  })

  it('should not display the height slider for the comparison table', () => {
    const store = renderAppWithOptionalData({
      comparison: comparisonTableFixture
    })
    setWrapperSize(store)

    const plotResizers = within(
      screen.getByTestId('size-sliders')
    ).getAllByRole('slider')

    expect(plotResizers.length).toBe(1)
  })

  it('should send a message to the extension with the selected size when changing the width of plots', () => {
    const store = renderAppWithOptionalData({
      custom: customPlotsFixture
    })
    setWrapperSize(store)

    const plotResizer = within(screen.getByTestId('size-sliders')).getAllByRole(
      'slider'
    )[0]

    fireEvent.change(plotResizer, { target: { value: -3 } })
    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: {
        height: 1,
        nbItemsPerRow: 3,
        section: PlotsSection.CUSTOM_PLOTS
      },
      type: MessageFromWebviewType.RESIZE_PLOTS
    })
  })

  it('should send a message to the extension with the selected size when changing the height of plots', () => {
    const store = renderAppWithOptionalData({
      custom: customPlotsFixture
    })
    setWrapperSize(store)

    const plotResizer = within(screen.getByTestId('size-sliders')).getAllByRole(
      'slider'
    )[1]

    fireEvent.change(plotResizer, { target: { value: 3 } })
    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: {
        height: 3,
        nbItemsPerRow: 2,
        section: PlotsSection.CUSTOM_PLOTS
      },
      type: MessageFromWebviewType.RESIZE_PLOTS
    })
  })

  it('should add a custom plot if a user creates a custom plot', () => {
    renderAppWithOptionalData({
      custom: {
        ...customPlotsFixture,
        plots: customPlotsFixture.plots.slice(0, 1)
      }
    })

    expect(
      screen.getAllByTestId(/summary\.json/).map(plot => plot.id)
    ).toStrictEqual(['custom-summary.json:loss-params.yaml:log_file'])

    sendSetDataMessage({
      custom: customPlotsFixture
    })

    expect(
      screen.getAllByTestId(/summary\.json/).map(plot => plot.id)
    ).toStrictEqual([
      'custom-summary.json:loss-params.yaml:log_file',
      'custom-summary.json:accuracy-params.yaml:epochs'
    ])
  })

  it('should remove a custom plot if a user deletes a custom plot', () => {
    renderAppWithOptionalData({
      custom: customPlotsFixture
    })

    expect(
      screen.getAllByTestId(/summary\.json/).map(plot => plot.id)
    ).toStrictEqual([
      'custom-summary.json:loss-params.yaml:log_file',
      'custom-summary.json:accuracy-params.yaml:epochs'
    ])

    sendSetDataMessage({
      custom: {
        ...customPlotsFixture,
        plots: customPlotsFixture.plots.slice(1)
      }
    })

    expect(
      screen.getAllByTestId(/summary\.json/).map(plot => plot.id)
    ).toStrictEqual(['custom-summary.json:accuracy-params.yaml:epochs'])
  })

  it('should render two template plot sections', () => {
    renderAppWithOptionalData({
      template: complexTemplatePlotsFixture
    })

    const sections = screen.getAllByTestId(/^plots-section_/)

    expect(sections.map(section => section.id)).toStrictEqual([
      'template-single_0',
      'template-multi_1'
    ])
  })

  it('should open a modal with the plot zoomed in when clicking a template plot', () => {
    renderAppWithOptionalData({
      template: complexTemplatePlotsFixture
    })

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    const plot = within(screen.getAllByTestId(/^plot_/)[0]).getByLabelText(
      'Open Plot in Popup'
    )

    fireEvent.click(plot)

    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })

  it('should send a message to the extension when a plot is opened in a modal', () => {
    renderAppWithOptionalData({
      template: complexTemplatePlotsFixture
    })

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

    const plot = within(screen.getAllByTestId(/^plot_/)[0]).getByLabelText(
      'Open Plot in Popup'
    )

    fireEvent.click(plot)

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: MessageFromWebviewType.ZOOM_PLOT
    })
  })

  it('should send a message with the plot path when a comparison table plot is zoomed', () => {
    renderAppWithOptionalData({
      comparison: comparisonTableFixture
    })

    const plot = screen.getAllByTestId('image-plot-button')[0]

    fireEvent.click(plot)

    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: comparisonTableFixture.plots[0].revisions.workspace.imgs[0].url,
      type: MessageFromWebviewType.ZOOM_PLOT
    })
  })

  it('should send a message with the plot path when a comparison table multi img plot is zoomed', () => {
    renderAppWithOptionalData({
      comparison: comparisonTableFixture
    })

    const plotWrapper = screen.getAllByTestId('multi-image-cell')[0]
    const plot = within(plotWrapper).getByTestId('image-plot-button')

    fireEvent.click(plot)

    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: comparisonTableFixture.plots[3].revisions.workspace.imgs[0].url,
      type: MessageFromWebviewType.ZOOM_PLOT
    })
  })

  it('should open a modal with the plot zoomed in when clicking a custom plot', () => {
    renderAppWithOptionalData({
      custom: customPlotsFixture
    })

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

    const plot = within(screen.getAllByTestId(/^plot_/)[0]).getByLabelText(
      'Open Plot in Popup'
    )

    fireEvent.click(plot)

    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })

  it('should open a modal with the plot zoomed in and actions menu open when clicking on a plot actions button', async () => {
    renderAppWithOptionalData({
      custom: customPlotsFixture
    })

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

    const plotActionsButton = within(
      screen.getAllByTestId(/^plot_/)[0]
    ).getByLabelText('See Plot Export Options')

    fireEvent.click(plotActionsButton)

    expect(screen.getByTestId('modal')).toBeInTheDocument()
    await waitFor(
      () => {
        expect(screen.getByTitle('Click to view actions')).toHaveAttribute(
          'open'
        )
      },
      { timeout: 5000 }
    )
  })

  it('should open a modal with the plot zoomed in and actions menu open when key pressing on a plot actions button', async () => {
    renderAppWithOptionalData({
      custom: customPlotsFixture
    })

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

    const plotActionsButton = within(
      screen.getAllByTestId(/^plot_/)[0]
    ).getByLabelText('See Plot Export Options')

    fireEvent.keyDown(plotActionsButton, { key: 'Enter' })

    expect(screen.getByTestId('modal')).toBeInTheDocument()
    await waitFor(
      () => {
        expect(screen.getByTitle('Click to view actions')).toHaveAttribute(
          'open'
        )
      },
      { timeout: 5000 }
    )
  })

  it('should not open a modal with the plot zoomed in when clicking a comparison table plot', () => {
    renderAppWithOptionalData({
      comparison: comparisonTableFixture,
      selectedRevisions: plotsRevisionsFixture
    })

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

    const [plot] = screen.getAllByAltText(/^Plot of/)

    expect(within(plot).queryByRole('button')).not.toBeInTheDocument()

    fireEvent.click(plot)

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })

  it('should close the zoomed plot modal when clicking the backdrop or the close button', () => {
    renderAppWithOptionalData({
      template: complexTemplatePlotsFixture
    })

    const plot = within(screen.getAllByTestId(/^plot_/)[0]).getByLabelText(
      'Open Plot in Popup'
    )

    fireEvent.click(plot)
    fireEvent.click(screen.getByTestId('modal'))

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

    fireEvent.click(plot)
    fireEvent.click(screen.getByTestId('modal-close'))

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })

  it('should not close the zoomed in plot modal when interacting with the plot inside (modal content)', () => {
    renderAppWithOptionalData({
      template: complexTemplatePlotsFixture
    })

    const plot = within(screen.getAllByTestId(/^plot_/)[0]).getByLabelText(
      'Open Plot in Popup'
    )

    fireEvent.click(plot)
    fireEvent.click(screen.getByTestId('modal-content'))

    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })

  it('should add a "save as svg" action to zoomed in plot modal', async () => {
    renderAppWithOptionalData({
      template: complexTemplatePlotsFixture
    })

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

    const plot = within(screen.getAllByTestId(/^plot_/)[0]).getByLabelText(
      'See Plot Export Options'
    )

    fireEvent.click(plot)

    const modal = screen.getByTestId('modal')

    const customAction = await within(modal).findByText('Save as SVG')

    expect(customAction).toBeInTheDocument()

    fireEvent.click(customAction)

    const svgString = expect.stringMatching('^<svg .*?</svg>$')
    await waitFor(
      () =>
        expect(mockPostMessage).toHaveBeenCalledWith({
          payload: svgString,
          type: MessageFromWebviewType.EXPORT_PLOT_AS_SVG
        }),
      { timeout: 1000 }
    )

    const stringContainingUnresolvedCssVars = expect.stringMatching(
      '^<svg .*?var\\(.*?\\).*?</svg>$'
    )
    expect(mockPostMessage).not.toHaveBeenCalledWith({
      payload: stringContainingUnresolvedCssVars,
      type: MessageFromWebviewType.EXPORT_PLOT_AS_SVG
    })
  })

  it('should add a "save as json" action to zoomed in plot modal', async () => {
    renderAppWithOptionalData({
      template: complexTemplatePlotsFixture
    })

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

    const plot = within(screen.getAllByTestId(/^plot_/)[0]).getByLabelText(
      'Open Plot in Popup'
    )

    fireEvent.click(plot)

    const modal = screen.getByTestId('modal')

    const customAction = await within(modal).findByText('Save as JSON')

    expect(customAction).toBeInTheDocument()

    fireEvent.click(customAction)

    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: complexTemplatePlotsFixture.plots[0].entries[0].id,
      type: MessageFromWebviewType.EXPORT_PLOT_DATA_AS_JSON
    })
  })

  it('should add a "save as csv" action to zoomed in plot modal', async () => {
    renderAppWithOptionalData({
      template: complexTemplatePlotsFixture
    })

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

    const plot = within(screen.getAllByTestId(/^plot_/)[0]).getByLabelText(
      'Open Plot in Popup'
    )

    fireEvent.click(plot)

    const modal = screen.getByTestId('modal')

    const customAction = await within(modal).findByText('Save as CSV')

    expect(customAction).toBeInTheDocument()

    fireEvent.click(customAction)

    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: complexTemplatePlotsFixture.plots[0].entries[0].id,
      type: MessageFromWebviewType.EXPORT_PLOT_DATA_AS_CSV
    })
  })

  it('should add a "save as tsv" action to zoomed in plot modal', async () => {
    renderAppWithOptionalData({
      template: complexTemplatePlotsFixture
    })

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

    const plot = within(screen.getAllByTestId(/^plot_/)[0]).getByLabelText(
      'Open Plot in Popup'
    )

    fireEvent.click(plot)

    const modal = screen.getByTestId('modal')

    const customAction = await within(modal).findByText('Save as TSV')

    expect(customAction).toBeInTheDocument()

    fireEvent.click(customAction)

    expect(mockPostMessage).toHaveBeenCalledWith({
      payload: complexTemplatePlotsFixture.plots[0].entries[0].id,
      type: MessageFromWebviewType.EXPORT_PLOT_DATA_AS_TSV
    })
  })

  it('should show a tooltip with the meaning of each plot section', () => {
    renderAppWithOptionalData({
      comparison: comparisonTableFixture,
      custom: customPlotsFixture,
      template: complexTemplatePlotsFixture
    })

    const [templateInfo, comparisonInfo, customInfo] = screen.getAllByTestId(
      'info-tooltip-toggle'
    )

    fireEvent.mouseEnter(templateInfo, { bubbles: true })
    expect(screen.getByTestId('tooltip-template-plots')).toBeInTheDocument()

    fireEvent.mouseEnter(comparisonInfo, { bubbles: true })
    expect(screen.getByTestId('tooltip-comparison-plots')).toBeInTheDocument()

    fireEvent.mouseEnter(customInfo, { bubbles: true })
    expect(screen.getByTestId('tooltip-custom-plots')).toBeInTheDocument()
  })

  it('should dismiss a tooltip by pressing esc', () => {
    renderAppWithOptionalData({
      comparison: comparisonTableFixture,
      custom: customPlotsFixture,
      template: complexTemplatePlotsFixture
    })

    const [templateInfo] = screen.getAllByTestId('info-tooltip-toggle')

    fireEvent.mouseEnter(templateInfo, { bubbles: true })
    expect(screen.getByTestId('tooltip-template-plots')).toBeInTheDocument()

    fireEvent.keyDown(templateInfo, { bubbles: true, key: 'Space' })
    expect(screen.getByTestId('tooltip-template-plots')).toBeInTheDocument()

    fireEvent.keyDown(templateInfo, { bubbles: true, key: 'Escape' })
    expect(
      screen.queryByTestId('tooltip-template-plots')
    ).not.toBeInTheDocument()
  })

  it('should update the scale of multiview plots when the number of revisions change', () => {
    renderAppWithOptionalData({
      template: complexTemplatePlotsFixture
    })

    const multiViewId = join('other', 'multiview.tsv')
    const multiViewPlot = screen.getByTestId(`plot_${multiViewId}`)

    expect(multiViewPlot).toHaveStyle('--scale: 5')

    sendSetDataMessage({
      template: {
        ...complexTemplatePlotsFixture,
        plots: [
          complexTemplatePlotsFixture.plots[0],
          {
            entries: [
              {
                ...templatePlot,
                id: join('other', 'multiview.tsv'),
                revisions: ['a', 'b']
              }
            ],
            group: TemplatePlotGroup.MULTI_VIEW
          }
        ]
      }
    })

    expect(multiViewPlot).toHaveStyle('--scale: 2')
  })

  describe('Drag and drop', () => {
    const toggleDragMode = (
      store: typeof plotsStore,
      forCustomPlots: boolean,
      on: boolean
    ) => {
      act(() => {
        store.dispatch(
          forCustomPlots
            ? toggleCustomPlotsDragAndDropMode(on)
            : toggleTemplatePlotsDragAndDropMode(on)
        )
      })
    }
    const renderAppWithOptionalDataInDragAndDropMode = (
      data?: PlotsData,
      forCustomPlots?: boolean
    ) => {
      const store = renderAppWithOptionalData(data)
      toggleDragMode(store, !!forCustomPlots, true)
      return store
    }

    it('should not be possible to drag a plot when the drag and drop mode is set to false', () => {
      const order = [
        join('logs', 'loss.tsv'),
        join('other', 'plot.tsv'),
        join('other', 'multiview.tsv')
      ]

      renderAppWithOptionalData({
        template: complexTemplatePlotsFixture
      })

      let plots = screen.getAllByTestId(/^plot_/)

      expect(plots.map(plot => plot.id)).toStrictEqual(order)

      mockPostMessage.mockClear()
      dragAndDrop(plots[1], plots[0])

      plots = screen.getAllByTestId(/^plot_/)

      expect(plots.map(plot => plot.id)).toStrictEqual(order)
    })

    it('should show the normal plots when not in drag and drop mode', () => {
      renderAppWithOptionalData({
        template: complexTemplatePlotsFixture
      })

      const [plot] = screen.getAllByTestId(/^plot_/)

      expect(within(plot).getAllByRole('button').length).toBe(2)
    })

    it('should toggle from normal to drag and drop mode when the user presses down on a plot grip icon', () => {
      const store = renderAppWithOptionalData({
        template: complexTemplatePlotsFixture
      })

      expect(store.getState().template.isInDragAndDropMode).toBe(false)

      const [plot] = screen.getAllByTestId(/^plot_/)
      fireEvent.mouseDown(within(plot).getByTestId('grip-icon'))

      expect(store.getState().template.isInDragAndDropMode).toBe(true)
    })

    it('should toggle from drag and drop to normal mode when dropping a plot', () => {
      const store = renderAppWithOptionalData({
        template: complexTemplatePlotsFixture
      })

      const [plot] = screen.getAllByTestId(/^plot_/)
      fireEvent.mouseDown(within(plot).getByTestId('grip-icon'))

      expect(store.getState().template.isInDragAndDropMode).toBe(true)

      const plots = screen.getAllByTestId(/^plot_/)
      dragAndDrop(plots[0], plots[1])

      expect(store.getState().template.isInDragAndDropMode).toBe(false)
    })

    it('should show only the titles when in drag and drop mode', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const [plot] = screen.getAllByTestId(/^plot_/)

      expect(within(plot).queryByRole('button')).not.toBeInTheDocument()
    })

    it('should show a formatted title of the metric and param when in drag and drop mode for custom plots', () => {
      renderAppWithOptionalDataInDragAndDropMode(
        {
          custom: customPlotsFixture
        },
        true
      )

      expect(screen.getByText('loss vs. log_file')).toBeInTheDocument()
    })

    it('should show a the full plot path as a subtitle when in drag and drop mode for custom plots', () => {
      renderAppWithOptionalDataInDragAndDropMode(
        {
          custom: customPlotsFixture
        },
        true
      )

      expect(
        screen.getByText('summary.json:loss-params.yaml:log_file')
      ).toBeInTheDocument()
    })

    it('should create a new section above the others if the template plot type is different than the first section', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const topSection = screen.getByTestId(NewSectionBlock.TOP)
      const multiViewPlot = screen.getByTestId(
        join('plot_other', 'multiview.tsv')
      )

      dragAndDrop(multiViewPlot, topSection)

      const sections = screen.getAllByTestId(/^plots-section_/)
      expect(sections.map(section => section.id)).toStrictEqual([
        'template-multi_0',
        'template-single_1'
      ])
    })

    it('should not create a new section above the others by dragging a template plot from the same type as the first section above it', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const topSection = screen.getByTestId(NewSectionBlock.TOP)
      const aSingleViewPlot = screen.getByTestId(join('plot_other', 'plot.tsv'))

      dragAndDrop(aSingleViewPlot, topSection)

      const sections = screen.getAllByTestId(/^plots-section_/)
      expect(sections.map(section => section.id)).toStrictEqual([
        'template-single_0',
        'template-multi_1'
      ])
    })

    it('should create a new section below the others if the template plot type is different than the last section', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const bottomSection = screen.getByTestId(NewSectionBlock.BOTTOM)
      const aSingleViewPlot = screen.getByTestId(join('plot_other', 'plot.tsv'))

      dragAndDrop(aSingleViewPlot, bottomSection)

      const sections = screen.getAllByTestId(/^plots-section_/)
      expect(sections.map(section => section.id)).toStrictEqual([
        'template-single_0',
        'template-multi_1',
        'template-single_2'
      ])
    })

    it('should not create a new section below the others by dragging a template plot from the same type as the last section below it', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const bottomSection = screen.getByTestId(NewSectionBlock.BOTTOM)
      const multiViewPlot = screen.getByTestId(
        join('plot_other', 'multiview.tsv')
      )

      dragAndDrop(multiViewPlot, bottomSection)

      const sections = screen.getAllByTestId(/^plots-section_/)
      expect(sections.map(section => section.id)).toStrictEqual([
        'template-single_0',
        'template-multi_1'
      ])
    })

    it('should move a template plot from one type in another section of the same type and show two drop targets', async () => {
      const store = renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const bottomSection = screen.getByTestId(NewSectionBlock.BOTTOM)
      const aSingleViewPlot = screen.getByTestId(join('plot_other', 'plot.tsv'))

      dragAndDrop(aSingleViewPlot, bottomSection)

      toggleDragMode(store, false, true)
      await screen.findByTestId('plots-section_template-single_2')
      const anotherSingleViewPlot = screen.getByTestId(
        join('plot_logs', 'loss.tsv')
      )
      const movedSingleViewPlot = screen.getByTestId(
        join('plot_other', 'plot.tsv')
      )

      dragEnter(
        anotherSingleViewPlot,
        movedSingleViewPlot.id,
        DragEnterDirection.LEFT
      )

      expect(screen.getAllByTestId('drop-target').length).toBe(2) // One in the old section and one in the new one

      dragAndDrop(anotherSingleViewPlot, movedSingleViewPlot)

      const sections = screen.getAllByTestId(/^plots-section_/)
      expect(sections.map(section => section.id)).toStrictEqual([
        'template-multi_0',
        'template-single_1'
      ])
    })

    it('should show a drop target at the end of the section when moving a plot from one section to another but not over any other plot', async () => {
      const store = renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const bottomSection = screen.getByTestId(NewSectionBlock.BOTTOM)
      const aSingleViewPlot = screen.getByTestId(join('plot_other', 'plot.tsv'))

      dragAndDrop(aSingleViewPlot, bottomSection)
      toggleDragMode(store, false, true)

      await screen.findByTestId('plots-section_template-single_2')
      const anotherSingleViewPlot = screen.getByTestId(
        join('plot_logs', 'loss.tsv')
      )

      dragEnter(
        anotherSingleViewPlot,
        'template-single_0',
        DragEnterDirection.LEFT
      )

      expect(screen.getByTestId('plot_drop-target')).toBeInTheDocument()
    })

    it('should show a drop target at the end of the template plots section when moving a plot inside of one section but not over any other plot', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const aSingleViewPlot = screen.getByTestId(join('plot_other', 'plot.tsv'))

      dragEnter(aSingleViewPlot, 'template-single_0', DragEnterDirection.LEFT)

      expect(screen.getByTestId('plot_drop-target')).toBeInTheDocument()
    })

    it('should drop a plot at the end of the template plots section when moving a plot inside of one section but not over any other plot', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const aSingleViewPlot = screen.getByTestId(join('plot_other', 'plot.tsv'))
      const topSection = screen.getByTestId('plots-section_template-single_0')

      dragAndDrop(aSingleViewPlot, topSection)
      const plots = within(topSection).getAllByTestId(/^plot_/)

      expect(plots.map(plot => plot.id)).toStrictEqual([
        join('logs', 'loss.tsv'),
        join('other', 'plot.tsv')
      ])
    })

    it('should show a drop target at the end of the custom plots when moving a plot inside the section', () => {
      renderAppWithOptionalDataInDragAndDropMode(
        {
          custom: customPlotsFixture
        },
        true
      )

      const plots = screen.getAllByTestId(/summary\.json/)

      dragEnter(plots[0], 'custom-plots', DragEnterDirection.LEFT)

      expect(screen.getByTestId('plot_drop-target')).toBeInTheDocument()
    })

    it('should show a drop target a plot at the end of the custom plots when moving a plot inside the section', () => {
      renderAppWithOptionalDataInDragAndDropMode(
        {
          custom: customPlotsFixture
        },
        true
      )

      const plots = screen.getAllByTestId(/summary\.json/)

      dragAndDrop(plots[0], screen.getByTestId('custom-plots'))

      const expectedOrder = [
        'custom-summary.json:accuracy-params.yaml:epochs',
        'custom-summary.json:loss-params.yaml:log_file'
      ]

      expect(
        screen.getAllByTestId(/summary\.json/).map(plot => plot.id)
      ).toStrictEqual(expectedOrder)
    })

    it('should show a drop zone when hovering a new section', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const topSection = screen.getByTestId(NewSectionBlock.TOP)
      const multiViewPlot = screen.getByTestId(
        join('plot_other', 'multiview.tsv')
      )
      let topDropIcon = screen.queryByTestId(`${NewSectionBlock.TOP}_drop-icon`)

      expect(topDropIcon).not.toBeInTheDocument()

      dragEnter(multiViewPlot, topSection.id, DragEnterDirection.LEFT)

      topDropIcon = screen.queryByTestId(`${NewSectionBlock.TOP}_drop-icon`)

      expect(topDropIcon).toBeInTheDocument()
    })

    it('should remove the drop zone when hovering out a new section', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const topSection = screen.getByTestId(NewSectionBlock.TOP)
      const multiViewPlot = screen.getByTestId(
        join('plot_other', 'multiview.tsv')
      )

      dragEnter(multiViewPlot, topSection.id, DragEnterDirection.LEFT)

      let topDropIcon = screen.queryByTestId(`${NewSectionBlock.TOP}_drop-icon`)

      expect(topDropIcon).toBeInTheDocument()

      dragLeave(topSection)

      topDropIcon = screen.queryByTestId(`${NewSectionBlock.TOP}_drop-icon`)

      expect(topDropIcon).not.toBeInTheDocument()
    })

    it('should not show a drop target when moving an element from a whole different section (comparison to template)', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        comparison: comparisonTableFixture,
        selectedRevisions: plotsRevisionsFixture,
        template: complexTemplatePlotsFixture
      })

      const headers = screen.getAllByRole('columnheader')
      const bottomSection = screen.getByTestId(NewSectionBlock.BOTTOM)

      dragEnter(headers[1], bottomSection.id, DragEnterDirection.LEFT)

      const bottomDropIcon = screen.queryByTestId(
        `${NewSectionBlock.BOTTOM}_drop-icon`
      )

      expect(bottomDropIcon).not.toBeInTheDocument()
    })

    it('should prevent default behaviour when dragging over a new section', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const topSection = screen.getByTestId(NewSectionBlock.TOP)

      act(() => {
        const dragOverEvent = createBubbledEvent('dragover', {
          preventDefault: jest.fn()
        })

        topSection.dispatchEvent(dragOverEvent)
        expect(dragOverEvent.preventDefault).toHaveBeenCalled()
      })
    })

    it('should show a drop target before a plot on drag enter from the left', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const plots = screen.getAllByTestId(/^plot_/)

      dragEnter(plots[1], plots[0].id, DragEnterDirection.LEFT)

      const plotsWithDropTarget = screen.getAllByTestId(/^plot_/)
      expect(plotsWithDropTarget.map(plot => plot.id)).toStrictEqual([
        'plot-drop-target',
        plots[0].id,
        plots[1].id,
        plots[2].id
      ])
    })

    it('should show a drop target after a plot on drag enter from the right', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const plots = screen.getAllByTestId(/^plot_/)

      dragEnter(
        plots[0],
        plots[1].id,
        DragEnterDirection.RIGHT,
        EventCurrentTargetDistances
      )

      const plotsWithDropTarget = screen.getAllByTestId(/^plot_/)

      expect(plotsWithDropTarget.map(plot => plot.id)).toStrictEqual([
        plots[0].id,
        plots[1].id,
        'plot-drop-target',
        plots[2].id
      ])
    })

    it('should hide the plot being dragged from the list', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const plots = screen.getAllByTestId(/^plot_/)
      expect(plots[1].style.display).not.toBe('none')

      dragEnter(plots[1], plots[1].id, DragEnterDirection.LEFT)

      expect(plots[1].style.display).toBe('none')
    })

    it('should remove the drop target after exiting a section after dragging in and out of it', () => {
      const store = renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      const movingPlotId = join('plot_other', 'plot.tsv')

      const bottomSection = screen.getByTestId(NewSectionBlock.BOTTOM)
      const aSingleViewPlot = screen.getByTestId(movingPlotId)

      dragAndDrop(aSingleViewPlot, bottomSection)

      toggleDragMode(store, false, true)
      const movedPlot = screen.getByTestId(movingPlotId)
      const otherSingleSection = screen.getByTestId(
        join('plot_logs', 'loss.tsv')
      )

      dragEnter(movedPlot, otherSingleSection.id, DragEnterDirection.LEFT)

      const topSection = screen.getByTestId('plots-section_template-single_0')

      let topSectionPlots = within(topSection)
        .getAllByTestId(/^plot_/)
        .map(plot => plot.id)
      expect(topSectionPlots.includes('plot-drop-target')).toBe(true)

      const previousSection = screen.getByTestId(
        'plots-section_template-single_2'
      )
      act(() => {
        previousSection.dispatchEvent(createBubbledEvent('dragenter'))
      })

      topSectionPlots = within(topSection)
        .getAllByTestId(/^plot_/)
        .map(plot => plot.id)
      expect(topSectionPlots.includes('plot-drop-target')).toBe(false)
    })

    it('should not be possible to drag a plot from a section to another', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        custom: customPlotsFixture,
        template: templatePlotsFixture
      })

      const customPlots = screen.getAllByTestId(/summary\.json/)
      const templatePlots = screen.getAllByTestId(/^plot_/)

      dragAndDrop(templatePlots[0], customPlots[1])

      expect(customPlots.map(plot => plot.id)).toStrictEqual([
        'custom-summary.json:loss-params.yaml:log_file',
        'custom-summary.json:accuracy-params.yaml:epochs'
      ])
    })

    it('should reorder template plots and send a message to the extension on drop', () => {
      renderAppWithOptionalDataInDragAndDropMode({
        template: complexTemplatePlotsFixture
      })

      let plots = screen.getAllByTestId(/^plot_/)

      expect(plots.map(plot => plot.id)).toStrictEqual([
        join('logs', 'loss.tsv'),
        join('other', 'plot.tsv'),
        join('other', 'multiview.tsv')
      ])

      mockPostMessage.mockClear()
      dragAndDrop(plots[1], plots[0])

      plots = screen.getAllByTestId(/^plot_/)

      expect(plots.map(plot => plot.id)).toStrictEqual([
        join('other', 'plot.tsv'),
        join('logs', 'loss.tsv'),
        join('other', 'multiview.tsv')
      ])
      expect(mockPostMessage).toHaveBeenCalledTimes(1)
      expect(mockPostMessage).toHaveBeenCalledWith({
        payload: [
          {
            group: TemplatePlotGroup.SINGLE_VIEW,
            paths: [join('other', 'plot.tsv'), join('logs', 'loss.tsv')]
          },
          {
            group: TemplatePlotGroup.MULTI_VIEW,
            paths: [join('other', 'multiview.tsv')]
          }
        ],
        type: MessageFromWebviewType.REORDER_PLOTS_TEMPLATES
      })
    })

    it('should send a message to the extension when the custom plots are reordered', () => {
      renderAppWithOptionalDataInDragAndDropMode(
        {
          custom: customPlotsFixture
        },
        true
      )

      const plots = screen.getAllByTestId(/summary\.json/)
      expect(plots.map(plot => plot.id)).toStrictEqual([
        'custom-summary.json:loss-params.yaml:log_file',
        'custom-summary.json:accuracy-params.yaml:epochs'
      ])

      mockPostMessage.mockClear()

      dragAndDrop(plots[1], plots[0])

      const expectedOrder = [
        'custom-summary.json:accuracy-params.yaml:epochs',
        'custom-summary.json:loss-params.yaml:log_file'
      ]

      expect(mockPostMessage).toHaveBeenCalledTimes(1)
      expect(mockPostMessage).toHaveBeenCalledWith({
        payload: expectedOrder,
        type: MessageFromWebviewType.REORDER_PLOTS_CUSTOM
      })
      expect(
        screen.getAllByTestId(/summary\.json/).map(plot => plot.id)
      ).toStrictEqual(expectedOrder)
    })

    it('should display the custom plots in the order stored', () => {
      renderAppWithOptionalDataInDragAndDropMode(
        {
          custom: customPlotsFixture
        },
        true
      )

      let plots = screen.getAllByTestId(/summary\.json/)

      expect(plots.map(plot => plot.id)).toStrictEqual([
        'custom-summary.json:loss-params.yaml:log_file',
        'custom-summary.json:accuracy-params.yaml:epochs'
      ])

      dragAndDrop(plots[1], plots[0])

      plots = screen.getAllByTestId(/summary\.json/)

      expect(plots.map(plot => plot.id)).toStrictEqual([
        'custom-summary.json:accuracy-params.yaml:epochs',
        'custom-summary.json:loss-params.yaml:log_file'
      ])
    })
  })

  describe('Comparison Multi Image Plots', () => {
    it('should render cells with sliders', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture
      })

      const multiImgPlot = screen.getAllByTestId('multi-image-cell')[0]
      const slider = within(multiImgPlot).getByRole('slider')

      expect(slider).toBeInTheDocument()
    })

    it('should update the cell image when the slider changes', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture
      })

      const workspaceImgs =
        comparisonTableFixture.plots[3].revisions.workspace.imgs
      const multiImgPlots = screen.getAllByTestId('multi-image-cell')
      const slider = within(multiImgPlots[0]).getByRole('slider')
      const workspaceImgEl = within(multiImgPlots[0]).getByRole('img')

      expect(workspaceImgEl).toHaveAttribute('src', workspaceImgs[0].url)

      fireEvent.change(slider, { target: { value: 3 } })

      expect(workspaceImgEl).toHaveAttribute('src', workspaceImgs[3].url)
    })

    it('should send a message when the slider changes', async () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture
      })

      const multiImg = comparisonTableFixture.plots[3]
      const workspacePlot = multiImg.revisions.workspace
      const workspaceImgs = workspacePlot.imgs

      const multiImgPlots = screen.getAllByTestId('multi-image-cell')
      const slider = within(multiImgPlots[0]).getByRole('slider')
      const workspaceImgEl = within(multiImgPlots[0]).getByRole('img')

      expect(workspaceImgEl).toHaveAttribute('src', workspaceImgs[0].url)

      fireEvent.change(slider, { target: { value: 3 } })

      await waitFor(
        () => {
          expect(mockPostMessage).toHaveBeenCalledWith({
            payload: {
              path: multiImg.path,
              revision: workspacePlot.id,
              value: 3
            },
            type: MessageFromWebviewType.SET_COMPARISON_MULTI_PLOT_VALUE
          })
        },
        { timeout: 1000 }
      )
    })

    it('should set default slider value if given a saved value', () => {
      const multiImg = comparisonTableFixture.plots[3]
      renderAppWithOptionalData({
        comparison: {
          ...comparisonTableFixture,
          multiPlotValues: { workspace: { [multiImg.path]: 3 } }
        }
      })

      const workspaceImgs = multiImg.revisions.workspace.imgs
      const multiImgPlots = screen.getAllByTestId('multi-image-cell')
      const workspaceImgEl = within(multiImgPlots[0]).getByRole('img')

      expect(workspaceImgEl).toHaveAttribute('src', workspaceImgs[3].url)
    })

    it('should disable the multi img row from drag and drop when hovering over a img slider', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture
      })

      const multiImgRow = screen.getAllByTestId('comparison-table-body')[3]
      const multiImgPlots = screen.getAllByTestId('multi-image-cell')
      const slider = within(multiImgPlots[0]).getByRole('slider')

      expect(multiImgRow.draggable).toBe(true)

      fireEvent.mouseEnter(slider)

      expect(multiImgRow.draggable).toBe(false)

      fireEvent.mouseLeave(slider)

      expect(multiImgRow.draggable).toBe(true)
    })

    it('should handle when a revision contains less images than before', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture
      })

      const mainImgs = comparisonTableFixture.plots[3].revisions.main.imgs
      const multiImgPlots = screen.getAllByTestId('multi-image-cell')
      const slider = within(multiImgPlots[1]).getByRole('slider')

      fireEvent.change(slider, { target: { value: 14 } })

      expect(within(multiImgPlots[1]).getByRole('img')).toHaveAttribute(
        'src',
        mainImgs[14].url
      )

      const dataWithLessMainImages = {
        comparison: {
          ...comparisonTableFixture,
          plots: comparisonTableFixture.plots.map(plot =>
            plot.path.includes('image')
              ? {
                  ...plot,
                  revisions: {
                    ...plot.revisions,
                    main: {
                      ...plot.revisions.main,
                      imgs: plot.revisions.main.imgs.slice(0, 7)
                    }
                  }
                }
              : plot
          )
        }
      }

      sendSetDataMessage(dataWithLessMainImages)

      expect(
        within(multiImgPlots[1]).queryByRole('img')
      ).not.toBeInTheDocument()
    })

    it('should handle a plot with steps that do not increment by one', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture
      })

      const unusualRev = 'exp-83425'
      const imgs = comparisonTableFixture.plots[3].revisions[unusualRev].imgs
      const multiImgPlot = screen.getAllByTestId('multi-image-cell')[4]

      const slider = within(multiImgPlot).getByRole('slider')
      const imgEl = within(multiImgPlot).getByRole('img')

      expect(slider).toHaveAttribute('max', '6')

      expect(imgEl).toHaveAttribute('src', imgs[0].url)
      expect(imgEl).toHaveAttribute(
        'alt',
        `1 of ${join('plots', 'image')} (exp-83425)`
      )
      expect(within(multiImgPlot).getByText('1')).toBeInTheDocument()

      fireEvent.change(slider, { target: { value: 3 } })

      expect(imgEl).toHaveAttribute('src', imgs[3].url)
      expect(imgEl).toHaveAttribute(
        'alt',
        `7 of ${join('plots', 'image')} (exp-83425)`
      )
      expect(within(multiImgPlot).getByText('7')).toBeInTheDocument()
    })
  })

  describe('Virtualization', () => {
    const createCustomPlots = (nbOfPlots: number): CustomPlotsData => {
      const plots = []
      for (let i = 0; i < nbOfPlots; i++) {
        const id = `plot-${i}`
        plots.push({
          anchorDefinitions: { DVC_METRIC_DATA: [] },
          content: {
            $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
            encoding: {},
            height: 100,
            layer: [],
            transform: [],
            width: 100
          },
          id,
          metric: '',
          param: ''
        })
      }
      return {
        ...customPlotsFixture,
        plots,
        selectedMetrics: plots.map(plot => plot.id)
      } as unknown as CustomPlotsData
    }

    const resizeScreen = (width: number, store: typeof plotsStore) => {
      act(() => {
        store.dispatch(setMaxNbPlotsPerRow(width))
      })
      act(() => {
        global.innerWidth = width
        global.dispatchEvent(new Event('resize'))
      })
    }

    describe('Large plots', () => {
      it('should  wrap the custom plots in a big grid (virtualize them) when there are more than eight large plots', async () => {
        await renderAppAndChangeSize(
          { custom: createCustomPlots(9) },
          1,
          PlotsSection.CUSTOM_PLOTS
        )

        expect(screen.getByRole('grid')).toBeInTheDocument()

        sendSetDataMessage({
          custom: createCustomPlots(50)
        })

        await screen.findAllByTestId('plots-wrapper')

        expect(screen.getByRole('grid')).toBeInTheDocument()
      })

      it('should not wrap the custom plots in a big grid (virtualize them) when there are eight or fewer large plots', async () => {
        await renderAppAndChangeSize(
          { custom: createCustomPlots(8) },
          1,
          PlotsSection.CUSTOM_PLOTS
        )

        expect(screen.queryByRole('grid')).not.toBeInTheDocument()

        sendSetDataMessage({
          custom: createCustomPlots(1)
        })

        await screen.findAllByTestId('plots-wrapper')

        expect(screen.queryByRole('grid')).not.toBeInTheDocument()
      })

      it('should  wrap the template plots in a big grid (virtualize them) when there are more than eight large plots', async () => {
        await renderAppAndChangeSize(
          { template: manyTemplatePlots(9) },
          1,
          PlotsSection.TEMPLATE_PLOTS
        )

        expect(screen.getByRole('grid')).toBeInTheDocument()

        sendSetDataMessage({
          template: manyTemplatePlots(50)
        })

        await screen.findAllByTestId('plots-wrapper')

        expect(screen.getByRole('grid')).toBeInTheDocument()
      })

      it('should not wrap the template plots in a big grid (virtualize them) when there are eight or fewer large plots', async () => {
        await renderAppAndChangeSize(
          { template: manyTemplatePlots(8) },
          1,
          PlotsSection.TEMPLATE_PLOTS
        )

        expect(screen.queryByRole('grid')).not.toBeInTheDocument()

        sendSetDataMessage({
          template: manyTemplatePlots(1)
        })

        await screen.findAllByTestId('plots-wrapper')

        expect(screen.queryByRole('grid')).not.toBeInTheDocument()
      })

      describe('Sizing', () => {
        const custom = createCustomPlots(25)

        it('should render the plots correctly when the screen is larger than 2000px', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            1,
            PlotsSection.CUSTOM_PLOTS
          )

          let plots = screen.getAllByTestId(/^plot_/)

          expect(plots[4].id).toBe('plot-4')
          expect(plots.length).toBe(OVERSCAN_ROW_COUNT + 1)

          resizeScreen(5453, store)

          plots = screen.getAllByTestId(/^plot_/)

          expect(plots[3].id).toBe('plot-3')
          expect(plots.length).toBe(OVERSCAN_ROW_COUNT + 1)
        })

        it('should render the plots correctly when the screen is larger than 1600px (but less than 2000px)', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            1,
            PlotsSection.CUSTOM_PLOTS
          )

          resizeScreen(1849, store)

          const plots = screen.getAllByTestId(/^plot_/)

          expect(plots[12].id).toBe('plot-12')
          expect(plots.length).toBe(OVERSCAN_ROW_COUNT + 1)
        })

        it('should render the plots correctly when the screen is larger than 800px (but less than 1600px)', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            1,
            PlotsSection.CUSTOM_PLOTS
          )

          resizeScreen(936, store)

          const plots = screen.getAllByTestId(/^plot_/)

          expect(plots[14].id).toBe('plot-14')
          expect(plots.length).toBe(1 + OVERSCAN_ROW_COUNT) // Only the first and the next lines defined by the overscan row count will be rendered
        })

        it('should render the plots correctly when the screen is smaller than 800px', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            1,
            PlotsSection.CUSTOM_PLOTS
          )

          resizeScreen(563, store)

          const plots = screen.getAllByTestId(/^plot_/)

          expect(plots[4].id).toBe('plot-4')
        })
      })
    })

    describe('Regular plots', () => {
      it('should  wrap the custom plots in a big grid (virtualize them) when there are more than fourteen regular plots', async () => {
        await renderAppAndChangeSize(
          { custom: createCustomPlots(15) },
          DEFAULT_NB_ITEMS_PER_ROW,
          PlotsSection.CUSTOM_PLOTS
        )

        expect(screen.getByRole('grid')).toBeInTheDocument()
      })

      it('should not wrap the custom plots in a big grid (virtualize them) when there are fourteen regular plots', async () => {
        await renderAppAndChangeSize(
          { custom: createCustomPlots(14) },
          DEFAULT_NB_ITEMS_PER_ROW,
          PlotsSection.CUSTOM_PLOTS
        )

        expect(screen.queryByRole('grid')).not.toBeInTheDocument()
      })

      it('should  wrap the template plots in a big grid (virtualize them) when there are more than fourteen regular plots', async () => {
        await renderAppAndChangeSize(
          { template: manyTemplatePlots(15) },
          DEFAULT_NB_ITEMS_PER_ROW,
          PlotsSection.TEMPLATE_PLOTS
        )

        expect(screen.getByRole('grid')).toBeInTheDocument()
      })

      it('should not wrap the template plots in a big grid (virtualize them) when there are fourteen or fewer regular plots', async () => {
        await renderAppAndChangeSize(
          { template: manyTemplatePlots(14) },
          DEFAULT_NB_ITEMS_PER_ROW,
          PlotsSection.TEMPLATE_PLOTS
        )

        expect(screen.queryByRole('grid')).not.toBeInTheDocument()
      })

      describe('Sizing', () => {
        const custom = createCustomPlots(25)

        it('should render the plots correctly when the screen is larger than 2000px', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            DEFAULT_NB_ITEMS_PER_ROW,
            PlotsSection.CUSTOM_PLOTS
          )

          resizeScreen(3200, store)

          let plots = screen.getAllByTestId(/^plot_/)

          expect(plots[20].id).toBe('plot-20')
          expect(plots.length).toBe(custom.plots.length)

          resizeScreen(6453, store)

          plots = screen.getAllByTestId(/^plot_/)

          expect(plots[19].id).toBe('plot-19')
          expect(plots.length).toBe(custom.plots.length)
        })

        it('should render the plots correctly when the screen is larger than 1600px (but less than 2000px)', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            DEFAULT_NB_ITEMS_PER_ROW,
            PlotsSection.CUSTOM_PLOTS
          )

          resizeScreen(1889, store)

          const plots = screen.getAllByTestId(/^plot_/)

          expect(plots[7].id).toBe('plot-7')
          expect(plots.length).toBe(custom.plots.length)
        })

        it('should render the plots correctly when the screen is larger than 800px (but less than 1600px)', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            DEFAULT_NB_ITEMS_PER_ROW,
            PlotsSection.CUSTOM_PLOTS
          )

          resizeScreen(938, store)

          const plots = screen.getAllByTestId(/^plot_/)

          expect(plots[7].id).toBe('plot-7')
          expect(plots.length).toBe(custom.plots.length)
        })

        it('should render the plots correctly when the screen is smaller than 800px', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            DEFAULT_NB_ITEMS_PER_ROW,
            PlotsSection.CUSTOM_PLOTS
          )

          resizeScreen(562, store)

          const plots = screen.getAllByTestId(/^plot_/)

          expect(plots[4].id).toBe('plot-4')
        })
      })
    })

    describe('Smaller plots', () => {
      it('should  wrap the custom plots in a big grid (virtualize them) when there are more than twenty small plots', async () => {
        await renderAppAndChangeSize(
          { custom: createCustomPlots(21) },
          4,
          PlotsSection.CUSTOM_PLOTS
        )

        expect(screen.getByRole('grid')).toBeInTheDocument()
      })

      it('should not wrap the custom plots in a big grid (virtualize them) when there are twenty or fewer small plots', async () => {
        await renderAppAndChangeSize(
          { custom: createCustomPlots(20) },
          4,
          PlotsSection.CUSTOM_PLOTS
        )

        expect(screen.queryByRole('grid')).not.toBeInTheDocument()
      })

      it('should  wrap the template plots in a big grid (virtualize them) when there are more than twenty small plots', async () => {
        await renderAppAndChangeSize(
          { template: manyTemplatePlots(21) },
          4,
          PlotsSection.TEMPLATE_PLOTS
        )

        expect(screen.getByRole('grid')).toBeInTheDocument()
      })

      it('should not wrap the template plots in a big grid (virtualize them) when there are twenty or fewer small plots', async () => {
        await renderAppAndChangeSize(
          { template: manyTemplatePlots(20) },
          4,
          PlotsSection.TEMPLATE_PLOTS
        )

        expect(screen.queryByRole('grid')).not.toBeInTheDocument()
      })

      describe('Sizing', () => {
        const custom = createCustomPlots(25)

        it('should render the plots correctly when the screen is larger than 2000px', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            4,
            PlotsSection.CUSTOM_PLOTS
          )

          resizeScreen(3004, store)

          let plots = screen.getAllByTestId(/^plot_/)

          expect(plots[7].id).toBe('plot-7')
          expect(plots.length).toBe(custom.plots.length)

          resizeScreen(5473, store)

          plots = screen.getAllByTestId(/^plot_/)

          expect(plots[9].id).toBe('plot-9')
          expect(plots.length).toBe(custom.plots.length)
        })

        it('should render the plots correctly when the screen is larger than 1600px (but less than 2000px)', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            4,
            PlotsSection.CUSTOM_PLOTS
          )

          resizeScreen(1839, store)

          const plots = screen.getAllByTestId(/^plot_/)

          expect(plots[24].id).toBe('plot-24')
          expect(plots.length).toBe(custom.plots.length)
        })

        it('should render the plots correctly when the screen is larger than 800px (but less than 1600px)', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            4,
            PlotsSection.CUSTOM_PLOTS
          )

          resizeScreen(956, store)

          const plots = screen.getAllByTestId(/^plot_/)

          expect(plots[9].id).toBe('plot-9')
          expect(plots.length).toBe(custom.plots.length)
        })

        it('should render the plots correctly when the screen is smaller than 800px but larger than 600px', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            4,
            PlotsSection.CUSTOM_PLOTS
          )

          resizeScreen(663, store)

          const plots = screen.getAllByTestId(/^plot_/)

          expect(plots[9].id).toBe('plot-9')
          expect(plots.length).toBe(custom.plots.length)
        })

        it('should render the plots correctly when the screen is smaller than 600px', async () => {
          const store = await renderAppAndChangeSize(
            { comparison: comparisonTableFixture, custom },
            4,
            PlotsSection.CUSTOM_PLOTS
          )

          resizeScreen(569, store)

          const plots = screen.getAllByTestId(/^plot_/)

          expect(plots[4].id).toBe('plot-4')
        })
      })
    })
  })

  // eslint-disable-next-line sonarjs/cognitive-complexity
  describe('Ribbon', () => {
    const getDisplayedRevisionOrder = () => {
      const ribbon = screen.getByTestId('ribbon')
      const revisionBlocks = within(ribbon).getAllByRole('listitem')
      return revisionBlocks
        .map(item => item.textContent)
        .filter(
          text =>
            !text?.includes(' of ') &&
            text !== 'Refresh All' &&
            text !== 'Add Plot'
        )
    }

    it('should show the revisions at the top', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture,

        selectedRevisions: plotsRevisionsFixture
      })

      expect(getDisplayedRevisionOrder()).toStrictEqual(
        plotsRevisionsFixture.map(rev =>
          rev.description ? rev.label + rev.description : rev.label
        )
      )
    })

    it('should send a message with the revision to be removed when clicking the clear button', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture,

        selectedRevisions: plotsRevisionsFixture
      })

      const mainClearButton = within(
        screen.getByTestId('ribbon-main')
      ).getAllByRole('button')[1]

      fireEvent.click(mainClearButton)

      expect(mockPostMessage).toHaveBeenCalledWith({
        payload: 'main',
        type: MessageFromWebviewType.TOGGLE_EXPERIMENT
      })
    })

    it('should display the number of experiments selected', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture,

        selectedRevisions: plotsRevisionsFixture
      })

      expect(
        screen.getByText(`${plotsRevisionsFixture.length} of 7`)
      ).toBeInTheDocument()
    })

    it('should send a message to add a plot when clicking the add plot button', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture,
        selectedRevisions: plotsRevisionsFixture
      })

      const addPlotButton = within(screen.getByTestId('ribbon')).getAllByRole(
        'button'
      )[0]

      mockPostMessage.mockReset()
      fireEvent.click(addPlotButton)

      expect(mockPostMessage).toHaveBeenCalledTimes(1)
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: MessageFromWebviewType.ADD_PLOT
      })
    })

    it('should send a message to select the revisions when clicking the filter button', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture,
        sectionCollapsed: DEFAULT_SECTION_COLLAPSED
      })

      const filterButton = within(screen.getByTestId('ribbon')).getAllByRole(
        'button'
      )[1]

      fireEvent.click(filterButton)

      expect(mockPostMessage).toHaveBeenCalledWith({
        type: MessageFromWebviewType.SELECT_EXPERIMENTS
      })
    })

    it('should send a message to refresh each revision when clicking the refresh all button', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture,
        selectedRevisions: plotsRevisionsFixture
      })

      const refreshAllButton = within(
        screen.getByTestId('ribbon')
      ).getAllByRole('button')[2]

      mockPostMessage.mockReset()
      fireEvent.click(refreshAllButton)

      expect(mockPostMessage).toHaveBeenCalledTimes(1)
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: MessageFromWebviewType.REFRESH_REVISIONS
      })
    })

    it('should show an error indicator for each revision with an error', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture,
        selectedRevisions: plotsRevisionsFixture.map(rev => {
          if (rev.label === 'main') {
            return {
              ...rev,
              errors: ['error']
            }
          }
          return rev
        })
      })
      const errorIndicators = screen.getAllByText('!')
      expect(errorIndicators).toHaveLength(1)
    })

    it('should not show an error indicator for a loading revision', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture,
        selectedRevisions: plotsRevisionsFixture.map(rev => {
          if (rev.label === 'main') {
            return {
              ...rev,
              errors: ['error'],
              fetched: false
            }
          }
          return rev
        })
      })
      expect(screen.queryByText('!')).not.toBeInTheDocument()
    })

    it('should show an error banner when there are plot errors found', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture,
        plotErrors: [
          { path: 'image-path', revs: [{ msg: 'error', rev: 'main' }] }
        ]
      })

      expect(screen.getByText('Show error')).toBeInTheDocument()

      sendSetDataMessage({
        plotErrors: [
          { path: 'image-path', revs: [{ msg: 'error', rev: 'main' }] },
          { path: 'second-image-path', revs: [{ msg: 'error', rev: 'main' }] }
        ]
      })

      expect(screen.getByText('Show 2 errors')).toBeInTheDocument()
    })

    it('should show a button that opens an error modal when there are plot errors found', () => {
      renderAppWithOptionalData({
        comparison: comparisonTableFixture,
        plotErrors: [
          { path: 'image-path', revs: [{ msg: 'error', rev: 'main' }] }
        ]
      })

      const showErrorsBtn = screen.getByText('Show error')

      expect(showErrorsBtn).toBeInTheDocument()

      fireEvent.click(showErrorsBtn)

      expect(screen.getByTestId('modal')).toBeInTheDocument()

      const modalContents = screen.getByTestId('errors-modal')

      expect(within(modalContents).getByText('image-path')).toBeInTheDocument()
      expect(within(modalContents).getByText('main')).toBeInTheDocument()
      expect(within(modalContents).getByText('error')).toBeInTheDocument()
    })
  })

  describe('Vega panels', () => {
    const smoothPlot = templatePlotsFixture.plots[0].entries[0]
    const smoothId = smoothPlot.id
    const withVegaPanels = {
      ...templatePlotsFixture,
      plots: [
        {
          entries: [smoothPlot],
          group: TemplatePlotGroup.SINGLE_VIEW
        }
      ]
    }

    const waitForVega = (plot: HTMLElement): Promise<void> =>
      waitFor(
        () =>
          // eslint-disable-next-line testing-library/no-node-access
          expect(plot.querySelectorAll('.marks')[0]).toBeInTheDocument(),
        { timeout: 5000 }
      )

    it('should disable zooming the template plot when clicking inside the vega panel', async () => {
      renderAppWithOptionalData({ template: withVegaPanels })

      const smoothPlot = screen.getByTestId(`plot_${smoothId}`)
      await waitForVega(smoothPlot)

      // eslint-disable-next-line testing-library/no-node-access
      const panel = smoothPlot.querySelector('.vega-bindings') || smoothPlot
      expect(panel).toBeInTheDocument()

      const clickEvent = createEvent.click(panel)
      clickEvent.stopPropagation = jest.fn()
      fireEvent(panel, clickEvent)
      expect(clickEvent.stopPropagation).toHaveBeenCalledTimes(1)
    })

    describe('Smooth Plots', () => {
      const waitSetValuePostMessage = (value: number) =>
        waitFor(
          () =>
            expect(mockPostMessage).toHaveBeenCalledWith({
              payload: { id: smoothId, value },
              type: MessageFromWebviewType.SET_SMOOTH_PLOT_VALUE
            }),
          { timeout: 5000 }
        )
      it('should send a message to save the value when a vega panel slider is interacted with', async () => {
        renderAppWithOptionalData({ template: withVegaPanels })

        const smoothPlot = screen.getByTestId(`plot_${smoothId}`)
        await waitForVega(smoothPlot)

        const slider = within(smoothPlot).getByRole('slider')
        expect(slider).toBeInTheDocument()

        fireEvent.change(slider as HTMLInputElement, { target: { value: 0.4 } })

        await waitSetValuePostMessage(0.4)
      })

      it('should send a message to save the value when a zoomed in plot vega panel slider is interacted with', async () => {
        renderAppWithOptionalData({ template: withVegaPanels })

        const smoothPlot = within(
          screen.getByTestId(`plot_${smoothId}`)
        ).getByLabelText('Open Plot in Popup')

        fireEvent.click(smoothPlot)

        const popup = screen.getByTestId('zoomed-in-plot')
        await waitForVega(popup)

        const slider = within(popup).getByRole('slider')
        expect(slider).toBeInTheDocument()

        fireEvent.change(slider as HTMLInputElement, { target: { value: 0.4 } })

        await waitSetValuePostMessage(0.4)
      })

      it('should set a vega panel slider value when given a default value', async () => {
        renderAppWithOptionalData({
          template: { ...withVegaPanels, smoothPlotValues: { [smoothId]: 0.6 } }
        })

        const smoothPlot = screen.getByTestId(`plot_${smoothId}`)
        await waitForVega(smoothPlot)

        const slider = within(smoothPlot).getByRole('slider')
        expect(slider).toBeInTheDocument()

        expect(slider).toHaveValue('0.6')
      })

      it('should set the zoomed in plot vega panel slider value when given a default value', async () => {
        renderAppWithOptionalData({
          template: { ...withVegaPanels, smoothPlotValues: { [smoothId]: 0.6 } }
        })

        const smoothPlot = within(
          screen.getByTestId(`plot_${smoothId}`)
        ).getByLabelText('Open Plot in Popup')

        fireEvent.click(smoothPlot)

        const popup = screen.getByTestId('zoomed-in-plot')
        await waitForVega(popup)

        const slider = within(popup).getByRole('slider')
        expect(slider).toBeInTheDocument()

        expect(slider).toHaveValue('0.6')
      })

      it('should update a vega panel slider value when given a new value', async () => {
        renderAppWithOptionalData({
          template: { ...withVegaPanels, smoothPlotValues: { [smoothId]: 0.2 } }
        })

        const smoothPlot = screen.getByTestId(`plot_${smoothId}`)

        await waitForVega(smoothPlot)

        const slider = within(smoothPlot).getByRole('slider')

        expect(slider).toBeInTheDocument()
        expect(slider).toHaveValue('0.2')

        sendSetDataMessage({
          template: {
            ...withVegaPanels,
            smoothPlotValues: { [smoothId]: 0.7 }
          }
        })

        await waitFor(() => expect(slider).toHaveValue('0.7'), {
          timeout: 5000
        })
      })
    })

    describe('Too many plots message', () => {
      it('should not display a message that only 20 plots are shown if shouldShowTooManyPlotsMessage is false', () => {
        renderAppWithOptionalData({
          shouldShowTooManyComparisonImagesMessage: false,
          shouldShowTooManyTemplatePlotsMessage: false,
          template: templatePlotsFixture
        })

        expect(
          screen.queryByTestId('too-many-plots-message')
        ).not.toBeInTheDocument()
      })

      it('should display a message that only 20 plots are shown for template plots if shouldShowTooManyTemplatePlotsMessage is true', () => {
        renderAppWithOptionalData({
          shouldShowTooManyTemplatePlotsMessage: true,
          template: templatePlotsFixture
        })

        expect(screen.getByTestId('too-many-plots-message')).toBeInTheDocument()
      })

      it('should display a message that only 20 plots are shown for the comparison table if shouldShowTooManyComparisonImagesMessage is true', () => {
        renderAppWithOptionalData({
          comparison: comparisonTableFixture,
          shouldShowTooManyComparisonImagesMessage: true
        })

        expect(screen.getByTestId('too-many-plots-message')).toBeInTheDocument()
      })
    })
  })
})
