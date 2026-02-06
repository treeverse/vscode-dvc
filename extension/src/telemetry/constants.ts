import { ViewColumn } from 'vscode'
import { WorkspaceScale } from './collect'
import { RegisteredCliCommands, RegisteredCommands } from '../commands/external'
import { SortDefinition } from '../experiments/model/sortBy'
import {
  PlotHeight,
  PlotsSection,
  SectionCollapsed
} from '../plots/webview/contract'

export const APPLICATION_INSIGHTS_CONNECTION_STRING =
  'InstrumentationKey=46e8e554-d50a-471a-a53b-4af2b1cd6594;IngestionEndpoint=https://westus2-2.in.applicationinsights.azure.com/;LiveEndpoint=https://westus2.livediagnostics.monitor.azure.com/;ApplicationId=f8ed111b-7a8f-4e59-94a5-9979333db978'

const ViewOpenedEvent = {
  VIEWS_EXPERIMENTS_FILTER_BY_TREE_OPENED:
    'views.experimentsFilterByTree.opened',
  VIEWS_EXPERIMENTS_METRICS_AND_PARAMS_TREE_OPENED:
    'views.experimentsColumnsTree.opened',
  VIEWS_EXPERIMENTS_SORT_BY_TREE_OPENED: 'views.experimentsSortByTree.opened',
  VIEWS_EXPERIMENTS_TREE_OPENED: 'views.experimentsTree.opened',
  VIEWS_PLOTS_PATH_TREE_OPENED: 'views.plotsPathTree.opened',
  VIEWS_TRACKED_EXPLORER_TREE_OPENED: 'views.trackedExplorerTree.opened'
} as const

export type ViewOpenedEventName =
  (typeof ViewOpenedEvent)[keyof typeof ViewOpenedEvent]

export const EventName = Object.assign(
  {
    EXTENSION_EXECUTION_DETAILS_CHANGED: 'extension.executionDetails.changed',
    EXTENSION_LOAD: 'extension.load',

    VIEWS_EXPERIMENTS_TABLE_CLOSED: 'views.experimentsTable.closed',
    VIEWS_EXPERIMENTS_TABLE_COLUMNS_REORDERED:
      'views.experimentsTable.columnsReordered',
    VIEWS_EXPERIMENTS_TABLE_COPY_STUDIO_LINK:
      'views.experimentsTable.copyStudioLink',
    VIEWS_EXPERIMENTS_TABLE_COPY_TO_CLIPBOARD:
      'views.experimentsTable.copyToClipboard',
    VIEWS_EXPERIMENTS_TABLE_CREATED: 'views.experimentsTable.created',
    VIEWS_EXPERIMENTS_TABLE_EXPERIMENT_STARS_TOGGLE:
      'views.experimentTable.toggleStars',
    VIEWS_EXPERIMENTS_TABLE_EXPERIMENT_TOGGLE:
      'views.experimentTable.toggleStatus',
    VIEWS_EXPERIMENTS_TABLE_FILTER_COLUMN: 'views.experimentTable.filterColumn',
    VIEWS_EXPERIMENTS_TABLE_FOCUS_CHANGED:
      'views.experimentsTable.focusChanged',
    VIEWS_EXPERIMENTS_TABLE_FOCUS_FILTERS_TREE:
      'views.experimentsTable.focusFiltersTree',
    VIEWS_EXPERIMENTS_TABLE_FOCUS_SORTS_TREE:
      'views.experimentsTable.focusSortsTree',
    VIEWS_EXPERIMENTS_TABLE_HIDE_COLUMN_PATH:
      'views.experimentsTable.hideColumnPath',
    VIEWS_EXPERIMENTS_TABLE_MOVE_TO_START: 'views.experimentsTable.moveToStart',
    VIEWS_EXPERIMENTS_TABLE_OPEN_PARAMS_FILE:
      'views.experimentsTable.paramsFileOpened',
    VIEWS_EXPERIMENTS_TABLE_REFRESH: 'views.experimentsTable.refresh',
    VIEWS_EXPERIMENTS_TABLE_REMOVE_COLUMN_FILTER:
      'views.experimentsTable.removeColumnFilter',
    VIEWS_EXPERIMENTS_TABLE_REMOVE_COLUMN_SORT:
      'views.experimentsTable.columnSortRemoved',
    VIEWS_EXPERIMENTS_TABLE_RESET_COMMITS:
      'views.experimentsTable.resetCommits',
    VIEWS_EXPERIMENTS_TABLE_RESIZE_COLUMN:
      'views.experimentsTable.columnResized',
    VIEWS_EXPERIMENTS_TABLE_SELECT_BRANCHES:
      'views.experimentsTable.selectBranches',
    VIEWS_EXPERIMENTS_TABLE_SELECT_COLUMNS:
      'views.experimentsTable.selectColumns',
    VIEWS_EXPERIMENTS_TABLE_SELECT_EXPERIMENTS_FOR_PLOTS:
      'views.experimentsTable.selectExperimentsForPlots',
    VIEWS_EXPERIMENTS_TABLE_SELECT_FIRST_COLUMNS:
      'views.experimentsTable.selectFirstColumns',

    VIEWS_EXPERIMENTS_TABLE_SET_MAX_HEADER_HEIGHT:
      'views.experimentsTable.updateHeaderMaxHeight',
    VIEWS_EXPERIMENTS_TABLE_SHOW_LESS_COMMITS:
      'views.experimentsTable.showLessCommits',
    VIEWS_EXPERIMENTS_TABLE_SHOW_MORE_COMMITS:
      'views.experimentsTable.showMoreCommits',
    VIEWS_EXPERIMENTS_TABLE_SORT_COLUMN:
      'views.experimentsTable.columnSortAdded',
    VIEWS_EXPERIMENTS_TABLE_TOGGLE_SHOW_ONLY_CHANGED:
      'views.experimentsTable.toggleShowOnlyChanged',

    VIEWS_PLOTS_CLOSED: 'views.plots.closed',
    VIEWS_PLOTS_COMPARISON_ROWS_REORDERED:
      'views.plots.comparisonRowsReordered',
    VIEWS_PLOTS_CREATED: 'views.plots.created',
    VIEWS_PLOTS_EXPERIMENT_TOGGLE: 'views.plots.toggleExperimentStatus',
    VIEWS_PLOTS_EXPORT_PLOT_AS_SVG: 'views.plots.exportPlotAsSvg',
    VIEWS_PLOTS_EXPORT_PLOT_DATA_AS_CSV: 'views.plots.exportPlotDataAsCsv',
    VIEWS_PLOTS_EXPORT_PLOT_DATA_AS_JSON: 'views.plots.exportPlotDataAsJson',
    VIEWS_PLOTS_EXPORT_PLOT_DATA_AS_TSV: 'views.plots.exportPlotDataAsTsv',
    VIEWS_PLOTS_FOCUS_CHANGED: 'views.plots.focusChanged',
    VIEWS_PLOTS_REVISIONS_REORDERED: 'views.plots.revisionsReordered',
    VIEWS_PLOTS_SECTION_RESIZED: 'views.plots.sectionResized',
    VIEWS_PLOTS_SECTION_TOGGLE: 'views.plots.toggleSection',
    VIEWS_PLOTS_SELECT_EXPERIMENTS: 'view.plots.selectExperiments',
    VIEWS_PLOTS_SELECT_PLOTS: 'view.plots.selectPlots',
    VIEWS_PLOTS_SET_COMPARISON_MULTI_PLOT_VALUE:
      'view.plots.setComparisonMultiPlotValue',
    VIEWS_PLOTS_SET_SMOOTH_PLOT_VALUE: 'view.plots.setSmoothPlotValues',
    VIEWS_PLOTS_ZOOM_PLOT: 'views.plots.zoomPlot',
    VIEWS_REORDER_PLOTS_CUSTOM: 'views.plots.customReordered',
    VIEWS_REORDER_PLOTS_TEMPLATES: 'views.plots.templatesReordered',

    VIEWS_SETUP_CLOSE: 'view.setup.closed',
    VIEWS_SETUP_CREATED: 'view.setup.created',
    VIEWS_SETUP_FOCUS_CHANGED: 'views.setup.focusChanged',
    VIEWS_SETUP_INIT_GIT: 'views.setup.initializeGit',
    VIEWS_SETUP_INSTALL_DVC: 'views.setup.installDvc',
    VIEWS_SETUP_REQUEST_STUDIO_TOKEN: 'view.setup.requestStudioToken',
    VIEWS_SETUP_SHOW_SCM_FOR_COMMIT: 'views.setup.showScmForCommit',
    VIEWS_SETUP_UPDATE_PYTHON_ENVIRONMENT:
      'views.setup.updatePythonEnvironment',
    VIEWS_SETUP_UPGRADE_DVC: 'view.setup.upgradeDvc',

    VIEWS_TERMINAL_CLOSED: 'views.terminal.closed',
    VIEWS_TERMINAL_CREATED: 'views.terminal.created',
    VIEWS_TERMINAL_FOCUS_CHANGED: 'views.terminal.focusChanged'
  } as const,
  ViewOpenedEvent,
  RegisteredCliCommands,
  RegisteredCommands
)

type DvcRootCount = { dvcRootCount: number }

type ExtensionProperties = {
  cliAccessible: boolean
  dvcPathUsed: boolean
  msPythonInstalled: boolean
  msPythonUsed: boolean
  pythonPathUsed: boolean
  templates?: number
  workspaceFolderCount: number
} & DvcRootCount &
  Partial<WorkspaceScale>

type WebviewFocusChangedProperties = {
  active: boolean
  viewColumn: ViewColumn | undefined
  visible: boolean
}

export interface IEventNamePropertyMapping {
  [EventName.EXTENSION_EXECUTION_DETAILS_CHANGED]: ExtensionProperties
  [EventName.EXTENSION_LOAD]: ExtensionProperties

  [EventName.EXPERIMENT_AND_PLOTS_SHOW]: undefined
  [EventName.EXPERIMENT_APPLY]: undefined
  [EventName.EXPERIMENT_BRANCH]: undefined
  [EventName.EXPERIMENT_COLUMNS_SELECT]: undefined
  [EventName.EXPERIMENT_COLUMNS_SELECT_FIRST]: undefined
  [EventName.EXPERIMENT_FILTER_ADD]: undefined
  [EventName.EXPERIMENT_FILTER_ADD_STARRED]: undefined
  [EventName.EXPERIMENT_FILTER_REMOVE]: undefined
  [EventName.EXPERIMENT_FILTERS_REMOVE]: undefined
  [EventName.EXPERIMENT_FILTERS_REMOVE_ALL]: undefined
  [EventName.EXPERIMENT_GARBAGE_COLLECT]: undefined
  [EventName.EXPERIMENT_METRICS_AND_PARAMS_TOGGLE]: undefined
  [EventName.EXPERIMENT_PUSH]: undefined
  [EventName.EXPERIMENTS_REFRESH]: undefined
  [EventName.EXPERIMENT_REMOVE]: undefined
  [EventName.EXPERIMENT_REMOVE_QUEUE]: undefined
  [EventName.EXPERIMENT_VIEW_RENAME]: undefined
  [EventName.EXPERIMENT_RUN]: undefined
  [EventName.EXPERIMENT_SELECT]: undefined
  [EventName.EXPERIMENT_SHOW]: undefined
  [EventName.EXPERIMENT_SORT_ADD_STARRED]: undefined
  [EventName.EXPERIMENT_SORT_ADD]: undefined
  [EventName.EXPERIMENT_SORT_REMOVE]: undefined
  [EventName.EXPERIMENT_SORTS_REMOVE_ALL]: undefined
  [EventName.EXPERIMENT_SORTS_REMOVE]: undefined
  [EventName.EXPERIMENT_TOGGLE]: undefined
  [EventName.EXPERIMENT_VIEW_APPLY]: undefined
  [EventName.EXPERIMENT_VIEW_BRANCH]: undefined
  [EventName.EXPERIMENT_VIEW_PUSH]: undefined
  [EventName.EXPERIMENT_VIEW_REMOVE]: undefined
  [EventName.EXPERIMENT_VIEW_SHOW_LOGS]: undefined
  [EventName.EXPERIMENT_VIEW_STOP]: undefined
  [EventName.QUEUE_EXPERIMENT]: undefined
  [EventName.EXPERIMENT_STOP]: undefined
  [EventName.QUEUE_START]: undefined
  [EventName.QUEUE_STOP]: undefined

  [EventName.EXPERIMENT_VIEW_QUEUE]: undefined
  [EventName.EXPERIMENT_VIEW_RUN]: undefined

  [EventName.MODIFY_WORKSPACE_PARAMS_AND_QUEUE]: undefined
  [EventName.MODIFY_WORKSPACE_PARAMS_AND_RUN]: undefined
  [EventName.STOP_EXPERIMENTS]: { stopped: boolean; wasRunning: boolean }

  [EventName.PIPELINE_SHOW_DAG]: undefined

  [EventName.STAGE_RUN]: undefined
  [EventName.STAGE_STATUS]: undefined
  [EventName.STAGE_COPY_COMMAND]: undefined
  [EventName.STAGE_SHOW_ACTIONS]: undefined
  [EventName.STAGE_RUN_SINGLE]: undefined

  [EventName.PLOTS_PATH_TOGGLE]: undefined
  [EventName.PLOTS_SHOW]: undefined
  [EventName.PLOTS_SELECT]: undefined
  [EventName.PLOTS_REFRESH]: undefined
  [EventName.PLOTS_CUSTOM_REMOVE]: undefined

  [EventName.ADD_PLOT]: { type: string | undefined }

  [EventName.ADD_TARGET]: undefined
  [EventName.CHECKOUT_TARGET]: undefined
  [EventName.CHECKOUT]: undefined
  [EventName.COMMIT_TARGET]: undefined
  [EventName.COMMIT]: undefined
  [EventName.DELETE_TARGET]: undefined
  [EventName.DISCARD_WORKSPACE_CHANGES]: undefined
  [EventName.INIT]: undefined
  [EventName.MOVE_TARGETS]: undefined
  [EventName.PULL_TARGET]: undefined
  [EventName.PULL]: undefined
  [EventName.PUSH_TARGET]: undefined
  [EventName.PUSH]: undefined
  [EventName.REMOVE_TARGET]: undefined

  [EventName.REMOTE_ADD]: undefined
  [EventName.REMOTE_MODIFY]: undefined
  [EventName.REMOTE_REMOVE]: undefined

  [EventName.GIT_STAGE_ALL]: undefined
  [EventName.GIT_UNSTAGE_ALL]: undefined

  [EventName.TRACKED_EXPLORER_COMPARE_SELECTED]: undefined
  [EventName.TRACKED_EXPLORER_COPY_FILE_PATH]: undefined
  [EventName.TRACKED_EXPLORER_COPY_REL_FILE_PATH]: undefined
  [EventName.TRACKED_EXPLORER_FIND_IN_FOLDER]: undefined
  [EventName.TRACKED_EXPLORER_OPEN_FILE]: undefined
  [EventName.TRACKED_EXPLORER_OPEN_TO_THE_SIDE]: undefined
  [EventName.TRACKED_EXPLORER_SELECT_FOR_COMPARE]: undefined

  [EventName.EXTENSION_CHECK_CLI_COMPATIBLE]: undefined
  [EventName.EXTENSION_GET_STARTED]: undefined
  [EventName.EXTENSION_SETUP_WORKSPACE]: { completed: boolean }
  [EventName.EXTENSION_SHOW_COMMANDS]: undefined
  [EventName.EXTENSION_SHOW_OUTPUT]: undefined

  [EventName.VIEWS_EXPERIMENTS_TREE_OPENED]: DvcRootCount
  [EventName.VIEWS_EXPERIMENTS_FILTER_BY_TREE_OPENED]: DvcRootCount
  [EventName.VIEWS_EXPERIMENTS_METRICS_AND_PARAMS_TREE_OPENED]: DvcRootCount
  [EventName.VIEWS_EXPERIMENTS_SORT_BY_TREE_OPENED]: DvcRootCount
  [EventName.VIEWS_EXPERIMENTS_TREE_OPENED]: DvcRootCount
  [EventName.VIEWS_EXPERIMENTS_TABLE_EXPERIMENT_TOGGLE]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_EXPERIMENT_STARS_TOGGLE]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_CLOSED]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_COLUMNS_REORDERED]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_FOCUS_FILTERS_TREE]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_FOCUS_SORTS_TREE]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_RESIZE_COLUMN]: {
    width: number
  }
  [EventName.VIEWS_EXPERIMENTS_TABLE_SET_MAX_HEADER_HEIGHT]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_SORT_COLUMN]: SortDefinition
  [EventName.VIEWS_EXPERIMENTS_TABLE_REFRESH]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_REMOVE_COLUMN_SORT]: {
    path: string
  }
  [EventName.VIEWS_EXPERIMENTS_TABLE_RESET_COMMITS]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_COPY_STUDIO_LINK]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_COPY_TO_CLIPBOARD]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_CREATED]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_FILTER_COLUMN]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_REMOVE_COLUMN_FILTER]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_FOCUS_CHANGED]: WebviewFocusChangedProperties
  [EventName.VIEWS_EXPERIMENTS_TABLE_HIDE_COLUMN_PATH]: {
    path: string
  }
  [EventName.VIEWS_EXPERIMENTS_TABLE_MOVE_TO_START]: { path: string }
  [EventName.VIEWS_EXPERIMENTS_TABLE_SELECT_BRANCHES]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_SELECT_COLUMNS]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_SELECT_EXPERIMENTS_FOR_PLOTS]: {
    experimentCount: number
  }
  [EventName.VIEWS_EXPERIMENTS_TABLE_SELECT_FIRST_COLUMNS]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_SHOW_MORE_COMMITS]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_SHOW_LESS_COMMITS]: undefined
  [EventName.VIEWS_EXPERIMENTS_TABLE_OPEN_PARAMS_FILE]: {
    path: string
  }
  [EventName.VIEWS_EXPERIMENTS_TABLE_TOGGLE_SHOW_ONLY_CHANGED]: undefined

  [EventName.VIEWS_PLOTS_CLOSED]: undefined
  [EventName.VIEWS_PLOTS_CREATED]: undefined
  [EventName.VIEWS_PLOTS_FOCUS_CHANGED]: WebviewFocusChangedProperties
  [EventName.VIEWS_PLOTS_REVISIONS_REORDERED]: undefined
  [EventName.VIEWS_PLOTS_COMPARISON_ROWS_REORDERED]: undefined
  [EventName.VIEWS_PLOTS_SECTION_RESIZED]: {
    section: PlotsSection
    nbItemsPerRow: number
    height: PlotHeight
  }
  [EventName.VIEWS_PLOTS_SECTION_TOGGLE]: Partial<SectionCollapsed>
  [EventName.VIEWS_PLOTS_SELECT_EXPERIMENTS]: undefined
  [EventName.VIEWS_PLOTS_SELECT_PLOTS]: undefined
  [EventName.VIEWS_PLOTS_EXPERIMENT_TOGGLE]: undefined
  [EventName.VIEWS_PLOTS_EXPORT_PLOT_AS_SVG]: undefined
  [EventName.VIEWS_PLOTS_EXPORT_PLOT_DATA_AS_CSV]: undefined
  [EventName.VIEWS_PLOTS_EXPORT_PLOT_DATA_AS_JSON]: undefined
  [EventName.VIEWS_PLOTS_EXPORT_PLOT_DATA_AS_TSV]: undefined

  [EventName.VIEWS_PLOTS_ZOOM_PLOT]: { isImage: boolean }
  [EventName.VIEWS_REORDER_PLOTS_CUSTOM]: undefined
  [EventName.VIEWS_REORDER_PLOTS_TEMPLATES]: undefined
  [EventName.VIEWS_PLOTS_SET_COMPARISON_MULTI_PLOT_VALUE]: undefined
  [EventName.VIEWS_PLOTS_SET_SMOOTH_PLOT_VALUE]: undefined

  [EventName.VIEWS_PLOTS_PATH_TREE_OPENED]: DvcRootCount

  [EventName.VIEWS_TERMINAL_CLOSED]: undefined
  [EventName.VIEWS_TERMINAL_FOCUS_CHANGED]: { active: boolean }
  [EventName.VIEWS_TERMINAL_CREATED]: undefined

  [EventName.VIEWS_TRACKED_EXPLORER_TREE_OPENED]: DvcRootCount

  [EventName.VIEWS_SETUP_CLOSE]: undefined
  [EventName.VIEWS_SETUP_CREATED]: undefined
  [EventName.VIEWS_SETUP_FOCUS_CHANGED]: undefined
  [EventName.VIEWS_SETUP_REQUEST_STUDIO_TOKEN]: undefined
  [EventName.VIEWS_SETUP_UPDATE_PYTHON_ENVIRONMENT]: undefined
  [EventName.VIEWS_SETUP_SHOW_SCM_FOR_COMMIT]: undefined
  [EventName.VIEWS_SETUP_INIT_GIT]: undefined
  [EventName.VIEWS_SETUP_INSTALL_DVC]: undefined
  [EventName.VIEWS_SETUP_UPGRADE_DVC]: undefined

  [EventName.SETUP_SHOW]: undefined
  [EventName.SETUP_SHOW_EXPERIMENTS]: undefined
  [EventName.SETUP_SHOW_DVC]: undefined
  [EventName.SELECT_FOCUSED_PROJECTS]: undefined
  [EventName.SETUP_SHOW_STUDIO_SETTINGS]: undefined
  [EventName.SETUP_SHOW_STUDIO_CONNECT]: undefined

  [EventName.ADD_STUDIO_ACCESS_TOKEN]: undefined
  [EventName.ADD_STUDIO_URL]: undefined
  [EventName.UPDATE_STUDIO_ACCESS_TOKEN]: undefined
  [EventName.UPDATE_STUDIO_URL]: undefined
  [EventName.REMOVE_STUDIO_ACCESS_TOKEN]: undefined
  [EventName.REMOVE_STUDIO_URL]: undefined

  [EventName.RESET_STATE]: undefined
}
