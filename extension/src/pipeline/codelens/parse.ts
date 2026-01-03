import yaml from 'yaml'

export enum StageType {
  SIMPLE = 'simple',
  MATRIX = 'matrix',
  FOREACH = 'foreach'
}

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

const extractForeachItems = (
  foreachData: unknown
): string[] => {
  if (Array.isArray(foreachData)) {
    return foreachData.map(item =>
      typeof item === 'object' ? String(foreachData.indexOf(item)) : String(item)
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

    const stages: StageInfo[] = []

    for (const item of stagesNode.items) {
      if (!yaml.isScalar(item.key) || !yaml.isMap(item.value)) {
        continue
      }

      const name = String(item.key.value)
      const stageNode = item.value
      const range = item.key.range

      if (!range) {
        continue
      }

      const lineNumber = lineCounter.linePos(range[0]).line

      const foreachNode = stageNode.get('foreach', true)
      const matrixNode = stageNode.get('matrix', true)
      const doNode = stageNode.get('do', true)

      let type = StageType.SIMPLE
      let cmd: string | undefined
      let matrixAxes: Record<string, string[]> | undefined
      let foreachItems: string[] | undefined

      if (foreachNode) {
        type = StageType.FOREACH
        foreachItems = extractForeachItems(
          yaml.isScalar(foreachNode)
            ? foreachNode.value
            : (foreachNode as yaml.YAMLMap | yaml.YAMLSeq).toJSON()
        )
        if (doNode && yaml.isMap(doNode)) {
          const cmdNode = doNode.get('cmd')
          cmd = cmdNode ? String(cmdNode) : undefined
        }
      } else if (matrixNode) {
        type = StageType.MATRIX
        matrixAxes = extractMatrixAxes(
          yaml.isScalar(matrixNode)
            ? matrixNode.value
            : (matrixNode as yaml.YAMLMap | yaml.YAMLSeq).toJSON()
        )
        const cmdNode = stageNode.get('cmd')
        cmd = cmdNode ? String(cmdNode) : undefined
      } else {
        const cmdNode = stageNode.get('cmd')
        cmd = cmdNode ? String(cmdNode) : undefined
      }

      stages.push({
        name,
        type,
        lineNumber,
        cmd,
        matrixAxes,
        foreachItems
      })
    }

    return stages
  } catch {
    return []
  }
}

export const resolveMatrixStageNames = (
  stageName: string,
  matrixAxes: Record<string, string[]>
): string[] => {
  const axisNames = Object.keys(matrixAxes)
  if (axisNames.length === 0) {
    return []
  }

  const combinations: string[][] = [[]]

  for (const axisName of axisNames) {
    const values = matrixAxes[axisName]
    const newCombinations: string[][] = []

    for (const combo of combinations) {
      for (const value of values) {
        newCombinations.push([...combo, value])
      }
    }
    combinations.length = 0
    combinations.push(...newCombinations)
  }

  return combinations.map(combo => `${stageName}@${combo.join('-')}`)
}

export const resolveForeachStageNames = (
  stageName: string,
  items: string[]
): string[] => {
  return items.map(item => `${stageName}@${item}`)
}

