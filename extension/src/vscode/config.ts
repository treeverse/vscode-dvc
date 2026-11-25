import { ConfigurationTarget, workspace } from 'vscode'

export enum ConfigKey {
  DO_NOT_INFORM_MAX_PLOTTED = 'dvc.doNotInformMaxExperimentsPlotted',
  DO_NOT_RECOMMEND_ADD_STUDIO_TOKEN = 'dvc.doNotRecommendAddStudioToken',
  DO_NOT_RECOMMEND_RED_HAT = 'dvc.doNotRecommendRedHatExtension',
  DO_NOT_RECOMMEND_MERMAID_SUPPORT = 'dvc.doNotRecommendMermaidSupportExtension',
  DO_NOT_SHOW_CLI_UNAVAILABLE = 'dvc.doNotShowCliUnavailable',
  DO_NOT_SHOW_SETUP_AFTER_INSTALL = 'dvc.doNotShowSetupAfterInstall',
  DVC_PATH = 'dvc.dvcPath',
  EXP_TABLE_HEAD_MAX_HEIGHT = 'dvc.experimentsTableHeadMaxHeight',
  FOCUSED_PROJECTS = 'dvc.focusedProjects',
  PIPELINE_COLLAPSE_FOREACH_MATRIX = 'dvc.pipelineGraph.collapseForeachMatrix',
  PYTHON_PATH = 'dvc.pythonPath'
}

export const getConfigValue = <T = string, D = string>(
  key: ConfigKey,
  defaultValue?: D | T
): T =>
  workspace.getConfiguration().get(key, defaultValue ?? '') as unknown as T

export const setConfigValue = (key: ConfigKey, value: unknown) =>
  workspace.getConfiguration().update(key, value)

export const setUserConfigValue = <T>(key: ConfigKey, value: T) =>
  workspace.getConfiguration().update(key, value, ConfigurationTarget.Global)
