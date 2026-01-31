import { join } from 'path'

export const UNEXPECTED_ERROR_CODE = 255
export const DOT_DVC = '.dvc'

const NESTED_DVC = join(DOT_DVC, 'config')
export const FULLY_NESTED_DVC = join('**', NESTED_DVC)

export const TEMP_DAG_FILE = join(DOT_DVC, 'tmp', 'dag.md')

export const TEMP_PLOTS_DIR = join(DOT_DVC, 'tmp', 'plots')

export const FIELD_SEPARATOR = '::'

export const TEMP_EXP_DIR = join(DOT_DVC, 'tmp', 'exps')
const TEMP_EXP_RUN_DIR = join(TEMP_EXP_DIR, 'run')
export const DVCLIVE_ONLY_RUNNING_SIGNAL_FILE = join(
  TEMP_EXP_RUN_DIR,
  'DVCLIVE_ONLY'
)
export const DVCLIVE_STEP_COMPLETED_SIGNAL_FILE = join(
  TEMP_EXP_RUN_DIR,
  'DVCLIVE_STEP_COMPLETED'
)
export const EXP_RWLOCK_FILE = join(TEMP_EXP_DIR, 'rwlock.lock')

export const DEFAULT_CURRENT_BRANCH_COMMITS_TO_SHOW = 3
export const DEFAULT_OTHER_BRANCH_COMMITS_TO_SHOW = 1
export const NUM_OF_COMMITS_TO_INCREASE = 2

export const MULTI_IMAGE_PATH_REG = /[^/]+[/\\]\d+\.[a-z]+$/i

export enum Command {
  ADD = 'add',
  CHECKOUT = 'checkout',
  COMMIT = 'commit',
  CONFIG = 'config',
  DATA = 'data',
  DAG = 'dag',
  EXPERIMENT = 'exp',
  INITIALIZE = 'init',
  MOVE = 'move',
  PLOTS = 'plots',
  PULL = 'pull',
  PUSH = 'push',
  QUEUE = 'queue',
  REMOVE = 'remove',
  REMOTE = 'remote',
  REPRO = 'repro',
  ROOT = 'root',
  PARAMS = 'params',
  METRICS = 'metrics',
  STAGE = 'stage',
  STATUS = 'status'
}

export enum SubCommand {
  ADD = 'add',
  DIFF = 'diff',
  LIST = 'list',
  MODIFY = 'modify',
  REMOVE = 'remove',
  RENAME = 'rename',
  STATUS = 'status',
  SHOW = 'show'
}

export enum Flag {
  ALL_COMMITS = '-A',
  DRY = '--dry',
  FOLLOW = '--follow',
  DEFAULT = '-d',
  FORCE = '-f',
  GLOBAL = '--global',
  GRANULAR = '--granular',
  JOBS = '-j',
  JSON = '--json',
  KILL = '--kill',
  LOCAL = '--local',
  MD = '--md',
  PROJECT = '--project',
  NUM_COMMIT = '-n',
  OUTPUT_PATH = '-o',
  SINGLE_ITEM = '-s',
  SUBDIRECTORY = '--subdir',
  SET_PARAM = '-S',
  SPLIT = '--split',
  UNCHANGED = '--unchanged',
  UNSET = '--unset',
  VERSION = '--version'
}

export enum ExperimentSubCommand {
  APPLY = 'apply',
  BRANCH = 'branch',
  GARBAGE_COLLECT = 'gc',
  PUSH = 'push',
  REMOVE = 'remove',
  RENAME = 'rename',
  RUN = 'run'
}

export enum QueueSubCommand {
  KILL = 'kill',
  LOGS = 'logs',
  START = 'start',
  STOP = 'stop'
}

export enum ExperimentFlag {
  NO_FETCH = '--no-fetch',
  QUEUE = '--queue',
  NUM_COMMIT = '-n',
  REV = '--rev'
}

export enum ConfigKey {
  STUDIO_TOKEN = 'studio.token',
  STUDIO_OFFLINE = 'studio.offline',
  STUDIO_URL = 'studio.url'
}

type Target = string

type Flags = Flag | ExperimentFlag

export type Args = (
  | Command
  | Target
  | ExperimentSubCommand
  | Flags
  | ConfigKey
)[]
