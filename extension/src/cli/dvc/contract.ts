import type { TopLevelSpec } from 'vega-lite'

export const MIN_CLI_VERSION = '3.33.3'
export const LATEST_TESTED_CLI_VERSION = '3.66.1'

export const PLOT_TEMPLATES = [
  'simple',
  'linear',
  'confusion',
  'confusion_normalized',
  'scatter',
  'scatter_jitter',
  'smooth',
  'bar_horizontal_sorted',
  'bar_horizontal'
]

type ErrorContents = { type: string; msg: string }

export type DvcError = { error: ErrorContents }

export type Changes = {
  added?: string[]
  deleted?: string[]
  modified?: string[]
  renamed?: { new: string; old: string }[]
  unknown?: string[]
}

export type DataStatusOutput = {
  committed?: Changes
  not_in_cache?: string[]
  unchanged?: string[]
  uncommitted?: Changes
}

type SingleValue = string | number | boolean | null
export type Value = SingleValue | SingleValue[]

type RelPathObject<T> = {
  [relPath: string]: T
}

export type ValueTree = {
  [key: string]: Value | ValueTree
}

export const isValueTree = (
  value: Value | ValueTree
): value is NonNullable<ValueTree> =>
  !!(value && !Array.isArray(value) && typeof value === 'object')

export enum ExecutorStatus {
  FAILED = 'failed',
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCESS = 'success'
}

export const EXPERIMENT_WORKSPACE_ID = 'workspace' as const

type Dep = { hash: null | string; size: null | number; nfiles: null | number }
type Out = Dep & { use_cache: boolean; is_data_source: boolean }

type Outs = RelPathObject<Out>
export type Deps = RelPathObject<Dep>

export type FileDataOrError = { data: ValueTree } | DvcError
export type MetricsOrParams = RelPathObject<FileDataOrError>

export const fileHasError = (file: FileDataOrError): file is DvcError =>
  !!(file as DvcError).error

export const DEFAULT_EXP_SHOW_OUTPUT = [
  {
    rev: EXPERIMENT_WORKSPACE_ID
  }
]

export type ExpData = {
  rev: string
  timestamp: string | null
  params: MetricsOrParams | null
  metrics: MetricsOrParams | null
  deps: Deps | null
  outs: Outs | null
  meta: { has_checkpoints?: boolean }
}

export enum Executor {
  DVC_TASK = 'dvc-task',
  WORKSPACE = 'workspace'
}

export type ExecutorState = {
  state: ExecutorStatus
  name: Executor | null
  local: {
    root: string | null
    log: string | null
    pid: number | null
    task_id?: string
    returncode: null | number
  } | null
} | null

export type ExpWithError = {
  rev: string
  name?: string
} & DvcError

type ExpWithData = {
  rev: string
  name?: string
  data?: ExpData
}

export type ExpState = ExpWithData | ExpWithError

export type ExpRange = {
  revs: ExpState[]
  name?: string
  executor: ExecutorState
}

export const experimentHasError = (
  expState: ExpState
): expState is ExpWithError => !!(expState as { error?: unknown }).error

export type ExpShowOutput = (ExpState & { experiments?: ExpRange[] | null })[]

export enum PlotsType {
  VEGA = 'vega',
  IMAGE = 'image'
}
export const isImagePlotOutput = (plot: {
  type: PlotsType
}): plot is ImagePlotOutput => plot.type === PlotsType.IMAGE

export const PLOT_REV_FIELD = 'rev' as const

export enum PLOT_ANCHORS {
  COLOR = '<DVC_METRIC_COLOR>',
  COLUMN = '<DVC_METRIC_COLUMN>',
  DATA = '<DVC_METRIC_DATA>',
  HEIGHT = '<DVC_METRIC_PLOT_HEIGHT>',
  METRIC_TYPE = '<DVC_METRIC_TYPE>',
  PARAM_TYPE = '<DVC_PARAM_TYPE>',
  SHAPE = '<DVC_METRIC_SHAPE>',
  STROKE_DASH = '<DVC_METRIC_STROKE_DASH>',
  TITLE = '<DVC_METRIC_TITLE>',
  WIDTH = '<DVC_METRIC_PLOT_WIDTH>',
  X = '<DVC_METRIC_X>',
  X_LABEL = '<DVC_METRIC_X_LABEL>',
  Y = '<DVC_METRIC_Y>',
  Y_LABEL = '<DVC_METRIC_Y_LABEL>',
  ZOOM_AND_PAN = '<DVC_METRIC_ZOOM_AND_PAN>'
}

export const ZOOM_AND_PAN_PROP = {
  bind: 'scales',
  name: 'grid',
  select: 'interval'
} as const

type FieldDef = { field: string }

type EmptyObject = Record<string, never>

export const PLOT_STROKE_DASH = [
  [1, 0],
  [8, 8],
  [8, 4],
  [4, 4],
  [4, 2],
  [2, 1],
  [1, 1]
] as const
export type StrokeDashValue = (typeof PLOT_STROKE_DASH)[number]

export const PLOT_SHAPE = ['square', 'circle', 'triangle', 'diamond'] as const

export type ShapeValue = (typeof PLOT_SHAPE)[number]

type Scale<T extends StrokeDashValue | string> = {
  domain: string[]
  range: T[]
}

export type StrokeDashScale = Scale<StrokeDashValue>

export type ShapeScale = Scale<ShapeValue>

type Encoding<T extends StrokeDashValue | string> = FieldDef & {
  scale: Scale<T>
  legend?: null | {
    symbolType?: string
    symbolFillColor?: string
    symbolStrokeColor?: string
  }
}

type MultiSourceEncoding<T extends StrokeDashValue | ShapeValue> =
  | Encoding<T>
  | EmptyObject

export type StrokeDashEncoding = MultiSourceEncoding<StrokeDashValue>

export type ShapeEncoding = MultiSourceEncoding<ShapeValue>

export type AnchorDefinitions = {
  [PLOT_ANCHORS.COLOR]?: Encoding<string>
  [PLOT_ANCHORS.COLUMN]?: EmptyObject | { sort: never[]; field: string }
  [PLOT_ANCHORS.DATA]?: Array<Record<string, unknown>>
  [PLOT_ANCHORS.HEIGHT]?: number | 'container'
  [PLOT_ANCHORS.METRIC_TYPE]?: 'quantitative' | 'nominal'
  [PLOT_ANCHORS.PARAM_TYPE]?: 'quantitative' | 'nominal'
  [PLOT_ANCHORS.SHAPE]?: MultiSourceEncoding<ShapeValue>
  [PLOT_ANCHORS.STROKE_DASH]?: MultiSourceEncoding<StrokeDashValue>
  [PLOT_ANCHORS.TITLE]?: string
  [PLOT_ANCHORS.WIDTH]?: number | 'container'
  [PLOT_ANCHORS.X]?: string
  [PLOT_ANCHORS.X_LABEL]?: string
  [PLOT_ANCHORS.Y]?: string
  [PLOT_ANCHORS.Y_LABEL]?: string
  [PLOT_ANCHORS.ZOOM_AND_PAN]?: typeof ZOOM_AND_PAN_PROP
}

export type TemplatePlotOutput = {
  anchor_definitions: AnchorDefinitions
  content: TopLevelSpec
  revisions: string[]
  type: PlotsType
}

export type ImagePlotOutput = {
  revisions: string[]
  type: PlotsType
  url: string
}

export type PlotOutput = TemplatePlotOutput | ImagePlotOutput

export interface PlotsData {
  [path: string]: PlotOutput[]
}

export type PlotError = {
  name?: string
  rev: string
  source?: string
} & ErrorContents

export type RawPlotsOutput = {
  data?: { [path: string]: PlotOutput[] }
  errors?: PlotError[]
}

export type PlotsOutput = RawPlotsOutput & {
  data: { [path: string]: PlotOutput[] }
}

export type PlotsOutputOrError = PlotsOutput | DvcError
