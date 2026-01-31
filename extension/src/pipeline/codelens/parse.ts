import yaml from 'yaml'

export enum StageType {
  SIMPLE = 'simple',
  MATRIX = 'matrix',
  FOREACH = 'foreach'
}

// eslint-disable-next-line import/no-unused-modules
export interface StageInfo {
  name: string
  type: StageType
  lineNumber: number
  cmd?: string
  matrixAxes?: Record<string, string[]>
  foreachItems?: string[]
}

const isMapping = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getNodeValue = (node: unknown): unknown => {
  if (yaml.isScalar(node)) {
    return node.value
  }
  if (yaml.isMap(node) || yaml.isSeq(node)) {
    return node.toJSON()
  }
  return undefined
}

const getCmdFromNode = (node: yaml.YAMLMap): string | undefined => {
  const cmdNode = node.get('cmd')
  return cmdNode ? String(cmdNode) : undefined
}

const extractForeachItems = (foreachData: unknown): string[] => {
  if (Array.isArray(foreachData)) {
    return foreachData.map((item, index) =>
      typeof item === 'object' ? String(index) : String(item)
    )
  }
  if (isMapping(foreachData)) {
    return Object.keys(foreachData)
  }
  return []
}

const extractMatrixAxes = (
  matrixData: unknown
): Record<string, string[]> | undefined => {
  if (!isMapping(matrixData)) {
    return undefined
  }

  const axes: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(matrixData)) {
    if (Array.isArray(value)) {
      axes[key] = value.map(String)
    }
  }
  return Object.keys(axes).length > 0 ? axes : undefined
}

const parseForeachStage = (
  stageNode: yaml.YAMLMap
): { cmd?: string; foreachItems?: string[] } => {
  const foreachNode = stageNode.get('foreach', true)
  const doNode = stageNode.get('do', true)
  const foreachItems = extractForeachItems(getNodeValue(foreachNode))
  const cmd = doNode && yaml.isMap(doNode) ? getCmdFromNode(doNode) : undefined
  return { cmd, foreachItems }
}

const parseMatrixStage = (
  stageNode: yaml.YAMLMap
): { cmd?: string; matrixAxes?: Record<string, string[]> } => {
  const matrixNode = stageNode.get('matrix', true)
  const matrixAxes = extractMatrixAxes(getNodeValue(matrixNode))
  const cmd = getCmdFromNode(stageNode)
  return { cmd, matrixAxes }
}

const parseStageItem = (
  item: yaml.Pair,
  lineCounter: yaml.LineCounter
): StageInfo | undefined => {
  if (!yaml.isScalar(item.key) || !yaml.isMap(item.value)) {
    return undefined
  }

  const range = item.key.range
  if (!range) {
    return undefined
  }

  const name = String(item.key.value)
  const stageNode = item.value
  const lineNumber = lineCounter.linePos(range[0]).line
  const hasForeach = stageNode.has('foreach')
  const hasMatrix = stageNode.has('matrix')

  if (hasForeach) {
    const { cmd, foreachItems } = parseForeachStage(stageNode)
    return { cmd, foreachItems, lineNumber, name, type: StageType.FOREACH }
  }

  if (hasMatrix) {
    const { cmd, matrixAxes } = parseMatrixStage(stageNode)
    return { cmd, lineNumber, matrixAxes, name, type: StageType.MATRIX }
  }

  return {
    cmd: getCmdFromNode(stageNode),
    lineNumber,
    name,
    type: StageType.SIMPLE
  }
}

export const parseStagesFromYaml = (content: string): StageInfo[] => {
  try {
    const lineCounter = new yaml.LineCounter()
    const doc = yaml.parseDocument(content, { lineCounter })

    if (!doc || doc.errors.length > 0) {
      return []
    }

    const stagesNode = doc.get('stages', true)
    if (!stagesNode || !yaml.isMap(stagesNode)) {
      return []
    }

    return stagesNode.items
      .map(item => parseStageItem(item, lineCounter))
      .filter((stage): stage is StageInfo => stage !== undefined)
  } catch {
    return []
  }
}

const cartesianProduct = (arrays: string[][]): string[][] => {
  let result: string[][] = [[]]
  for (const values of arrays) {
    result = result.flatMap(combo => values.map(v => [...combo, v]))
  }
  return result
}

export const resolveMatrixStageNames = (
  stageName: string,
  matrixAxes: Record<string, string[]>
): string[] => {
  const axisNames = Object.keys(matrixAxes)
  if (axisNames.length === 0) {
    return []
  }
  const axisValues = axisNames.map(name => matrixAxes[name])
  return cartesianProduct(axisValues).map(
    combo => `${stageName}@${combo.join('-')}`
  )
}

export const resolveForeachStageNames = (
  stageName: string,
  items: string[]
): string[] => items.map(item => `${stageName}@${item}`)
