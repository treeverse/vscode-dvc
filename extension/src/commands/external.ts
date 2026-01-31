export enum RegisteredCliCommands {
  EXPERIMENT_APPLY = 'dvc.applyExperiment',
  EXPERIMENT_BRANCH = 'dvc.branchExperiment',
  EXPERIMENT_GARBAGE_COLLECT = 'dvc.experimentGarbageCollect',
  EXPERIMENT_PUSH = 'dvc.pushExperiments',
  EXPERIMENT_REMOVE = 'dvc.removeExperiments',
  EXPERIMENT_REMOVE_QUEUE = 'dvc.removeExperimentQueue',
  EXPERIMENT_RUN = 'dvc.runExperiment',
  QUEUE_EXPERIMENT = 'dvc.queueExperiment',
  QUEUE_START = 'dvc.startExperimentsQueue',
  QUEUE_STOP = 'dvc.stopExperimentsQueue',

  EXPERIMENT_VIEW_APPLY = 'dvc.views.experiments.applyExperiment',
  EXPERIMENT_VIEW_BRANCH = 'dvc.views.experiments.branchExperiment',
  EXPERIMENT_VIEW_PUSH = 'dvc.views.experiments.pushExperiment',
  EXPERIMENT_VIEW_REMOVE = 'dvc.views.experiments.removeExperiment',
  EXPERIMENT_VIEW_RENAME = 'dvc.views.experiments.renameExperiment',
  EXPERIMENT_VIEW_SHOW_LOGS = 'dvc.views.experiments.showLogs',

  EXPERIMENT_VIEW_QUEUE = 'dvc.views.experiments.queueExperiment',
  EXPERIMENT_VIEW_RUN = 'dvc.views.experiments.runExperiment',

  MODIFY_WORKSPACE_PARAMS_AND_QUEUE = 'dvc.modifyWorkspaceParamsAndQueue',
  MODIFY_WORKSPACE_PARAMS_AND_RUN = 'dvc.modifyWorkspaceParamsAndRun',

  ADD_TARGET = 'dvc.addTarget',
  CHECKOUT = 'dvc.checkout',
  CHECKOUT_TARGET = 'dvc.checkoutTarget',
  COMMIT = 'dvc.commit',
  COMMIT_TARGET = 'dvc.commitTarget',
  INIT = 'dvc.init',
  PULL = 'dvc.pull',
  PULL_TARGET = 'dvc.pullTarget',
  PUSH = 'dvc.push',
  PUSH_TARGET = 'dvc.pushTarget',
  REMOVE_TARGET = 'dvc.removeTarget',

  REMOTE_ADD = 'dvc.addRemote',
  REMOTE_MODIFY = 'dvc.modifyRemote',
  REMOTE_REMOVE = 'dvc.removeRemote',

  GIT_STAGE_ALL = 'dvc.gitStageAll',
  GIT_UNSTAGE_ALL = 'dvc.gitUnstageAll'
}

export enum RegisteredCommands {
  EXPERIMENT_COLUMNS_SELECT = 'dvc.views.experiments.selectColumns',
  EXPERIMENT_COLUMNS_SELECT_FIRST = 'dvc.views.experiments.selectFirstColumns',
  EXPERIMENT_FILTER_ADD = 'dvc.addExperimentsTableFilter',
  EXPERIMENT_FILTER_ADD_STARRED = 'dvc.addStarredExperimentsTableFilter',
  EXPERIMENT_FILTER_REMOVE = 'dvc.views.experimentsFilterByTree.removeFilter',
  EXPERIMENT_FILTERS_REMOVE = 'dvc.removeExperimentsTableFilters',
  EXPERIMENT_FILTERS_REMOVE_ALL = 'dvc.views.experimentsFilterByTree.removeAllFilters',
  EXPERIMENT_METRICS_AND_PARAMS_TOGGLE = 'dvc.views.experimentsColumnsTree.toggleStatus',
  EXPERIMENT_SELECT = 'dvc.views.experimentsTree.selectExperiments',
  EXPERIMENT_SHOW = 'dvc.showExperiments',
  EXPERIMENT_SORT_ADD = 'dvc.addExperimentsTableSort',
  EXPERIMENT_SORT_ADD_STARRED = 'dvc.addStarredExperimentsTableSort',
  EXPERIMENT_SORT_REMOVE = 'dvc.views.experimentsSortByTree.removeSort',
  EXPERIMENT_SORTS_REMOVE = 'dvc.removeExperimentsTableSorts',
  EXPERIMENT_SORTS_REMOVE_ALL = 'dvc.views.experimentsSortByTree.removeAllSorts',
  EXPERIMENT_STOP = 'dvc.stopExperiments',
  EXPERIMENT_TOGGLE = 'dvc.views.experiments.toggleStatus',
  EXPERIMENT_VIEW_STOP = 'dvc.views.experiments.stopExperiment',
  EXPERIMENTS_REFRESH = 'dvc.views.experiments.refresh',
  STOP_EXPERIMENTS = 'dvc.stopAllRunningExperiments',

  PIPELINE_SHOW_DAG = 'dvc.showPipelineDAG',

  STAGE_RUN = 'dvc.stage.run',
  STAGE_STATUS = 'dvc.stage.status',
  STAGE_COPY_COMMAND = 'dvc.stage.copyCommand',
  STAGE_SHOW_ACTIONS = 'dvc.stage.showActions',
  STAGE_RUN_SINGLE = 'dvc.stage.runSingle',

  PLOTS_PATH_TOGGLE = 'dvc.views.plotsPathsTree.toggleStatus',
  PLOTS_SHOW = 'dvc.showPlots',
  PLOTS_SELECT = 'dvc.views.plotsPathsTree.selectPlots',
  PLOTS_REFRESH = 'dvc.views.plots.refreshPlots',
  PLOTS_CUSTOM_REMOVE = 'dvc.views.plots.removeCustomPlots',

  ADD_PLOT = 'dvc.addPlot',

  EXPERIMENT_AND_PLOTS_SHOW = 'dvc.showExperimentsAndPlots',

  EXTENSION_CHECK_CLI_COMPATIBLE = 'dvc.checkCLICompatible',
  EXTENSION_GET_STARTED = 'dvc.getStarted',
  EXTENSION_SETUP_WORKSPACE = 'dvc.setupWorkspace',
  EXTENSION_SHOW_COMMANDS = 'dvc.showCommands',
  EXTENSION_SHOW_OUTPUT = 'dvc.showOutput',

  DELETE_TARGET = 'dvc.deleteTarget',
  MOVE_TARGETS = 'dvc.moveTargets',

  DISCARD_WORKSPACE_CHANGES = 'dvc.discardWorkspaceChanges',

  TRACKED_EXPLORER_OPEN_FILE = 'dvc.views.trackedExplorerTree.openFile',
  TRACKED_EXPLORER_COMPARE_SELECTED = 'dvc.compareSelected',
  TRACKED_EXPLORER_COPY_FILE_PATH = 'dvc.copyFilePath',
  TRACKED_EXPLORER_COPY_REL_FILE_PATH = 'dvc.copyRelativeFilePath',
  TRACKED_EXPLORER_FIND_IN_FOLDER = 'dvc.findInFolder',
  TRACKED_EXPLORER_OPEN_TO_THE_SIDE = 'dvc.openToTheSide',
  TRACKED_EXPLORER_SELECT_FOR_COMPARE = 'dvc.selectForCompare',

  SETUP_SHOW = 'dvc.showSetup',
  SETUP_SHOW_EXPERIMENTS = 'dvc.showExperimentsSetup',
  SETUP_SHOW_DVC = 'dvc.showDvcSetup',
  SELECT_FOCUSED_PROJECTS = 'dvc.selectFocusedProjects',

  ADD_STUDIO_ACCESS_TOKEN = 'dvc.addStudioAccessToken',
  ADD_STUDIO_URL = 'dvc.addStudioUrl',
  UPDATE_STUDIO_ACCESS_TOKEN = 'dvc.updateStudioAccessToken',
  UPDATE_STUDIO_URL = 'dvc.updateStudioUrl',
  REMOVE_STUDIO_ACCESS_TOKEN = 'dvc.removeStudioAccessToken',
  REMOVE_STUDIO_URL = 'dvc.removeStudioUrl',
  SETUP_SHOW_STUDIO_CONNECT = 'dvc.showStudioConnect',
  SETUP_SHOW_STUDIO_SETTINGS = 'dvc.showStudioSettings',

  RESET_STATE = 'dvc.resetState'
}
