import {
  parseStagesFromYaml,
  resolveForeachStageNames,
  resolveMatrixStageNames,
  StageType
} from './parse'

const SIMPLE_DVC_YAML = `stages:
  train:
    cmd: python train.py
    deps:
      - train.py
    outs:
      - model.pkl

  evaluate:
    cmd: python evaluate.py
    deps:
      - evaluate.py
      - model.pkl
    metrics:
      - metrics.json
`

const FOREACH_DVC_YAML = `stages:
  process:
    foreach:
      - raw1
      - raw2
      - raw3
    do:
      cmd: python process.py \${item}
      outs:
        - \${item}.processed
`

const MATRIX_DVC_YAML = `stages:
  train:
    matrix:
      model: [cnn, xgb]
      feature: [feat1, feat2]
    cmd: python train.py --model \${item.model} --feature \${item.feature}
    outs:
      - \${item.model}_\${item.feature}.pkl
`

const MIXED_DVC_YAML = `stages:
  prepare:
    cmd: python prepare.py
    deps:
      - data/raw
    outs:
      - data/prepared

  train:
    matrix:
      model: [cnn, xgb]
    cmd: python train.py --model \${item.model}
    deps:
      - data/prepared
    outs:
      - models/\${item.model}.pkl

  cleanup:
    foreach:
      - temp1
      - temp2
    do:
      cmd: rm -rf \${item}
`

const FOREACH_DICT_DVC_YAML = `stages:
  process:
    foreach:
      us: data/us.csv
      uk: data/uk.csv
    do:
      cmd: python process.py \${item}
      outs:
        - \${key}_processed.csv
`

describe('parseStagesFromYaml', () => {
  it('should parse simple stages with correct line numbers', () => {
    const stages = parseStagesFromYaml(SIMPLE_DVC_YAML)

    expect(stages).toHaveLength(2)
    expect(stages[0]).toMatchObject({
      lineNumber: 2,
      name: 'train',
      type: StageType.SIMPLE
    })
    expect(stages[1]).toMatchObject({
      lineNumber: 9,
      name: 'evaluate',
      type: StageType.SIMPLE
    })
  })

  it('should detect foreach stages', () => {
    const stages = parseStagesFromYaml(FOREACH_DVC_YAML)

    expect(stages).toHaveLength(1)
    expect(stages[0]).toMatchObject({
      lineNumber: 2,
      name: 'process',
      type: StageType.FOREACH
    })
    expect(stages[0].foreachItems).toStrictEqual(['raw1', 'raw2', 'raw3'])
  })

  it('should detect matrix stages', () => {
    const stages = parseStagesFromYaml(MATRIX_DVC_YAML)

    expect(stages).toHaveLength(1)
    expect(stages[0]).toMatchObject({
      lineNumber: 2,
      name: 'train',
      type: StageType.MATRIX
    })
    expect(stages[0].matrixAxes).toStrictEqual({
      feature: ['feat1', 'feat2'],
      model: ['cnn', 'xgb']
    })
  })

  it('should handle mixed stage types', () => {
    const stages = parseStagesFromYaml(MIXED_DVC_YAML)

    expect(stages).toHaveLength(3)
    expect(stages[0]).toMatchObject({
      name: 'prepare',
      type: StageType.SIMPLE
    })
    expect(stages[1]).toMatchObject({
      name: 'train',
      type: StageType.MATRIX
    })
    expect(stages[2]).toMatchObject({
      name: 'cleanup',
      type: StageType.FOREACH
    })
  })

  it('should handle foreach with dictionary items', () => {
    const stages = parseStagesFromYaml(FOREACH_DICT_DVC_YAML)

    expect(stages).toHaveLength(1)
    expect(stages[0]).toMatchObject({
      name: 'process',
      type: StageType.FOREACH
    })
    expect(stages[0].foreachItems).toStrictEqual(['us', 'uk'])
  })

  it('should return empty array for invalid yaml', () => {
    const stages = parseStagesFromYaml('invalid: yaml: content:')

    expect(stages).toStrictEqual([])
  })

  it('should return empty array for yaml without stages', () => {
    const stages = parseStagesFromYaml('vars:\n  - params.yaml\n')

    expect(stages).toStrictEqual([])
  })

  it('should extract cmd from simple stages', () => {
    const stages = parseStagesFromYaml(SIMPLE_DVC_YAML)

    expect(stages[0].cmd).toBe('python train.py')
    expect(stages[1].cmd).toBe('python evaluate.py')
  })

  it('should extract cmd from matrix stage do block', () => {
    const stages = parseStagesFromYaml(MATRIX_DVC_YAML)

    const expectedCmd =
      // eslint-disable-next-line no-template-curly-in-string
      'python train.py --model ${item.model} --feature ${item.feature}'
    expect(stages[0].cmd).toBe(expectedCmd)
  })

  it('should extract cmd from foreach stage do block', () => {
    const stages = parseStagesFromYaml(FOREACH_DVC_YAML)

    // eslint-disable-next-line no-template-curly-in-string
    expect(stages[0].cmd).toBe('python process.py ${item}')
  })
})

describe('resolveMatrixStageNames', () => {
  it('should generate all combinations for matrix axes', () => {
    const matrixAxes = {
      feature: ['feat1', 'feat2'],
      model: ['cnn', 'xgb']
    }

    const names = resolveMatrixStageNames('train', matrixAxes)

    expect(names).toHaveLength(4)
    expect(names).toContain('train@feat1-cnn')
    expect(names).toContain('train@feat1-xgb')
    expect(names).toContain('train@feat2-cnn')
    expect(names).toContain('train@feat2-xgb')
  })

  it('should handle single axis matrix', () => {
    const matrixAxes = {
      model: ['cnn', 'xgb', 'rf']
    }

    const names = resolveMatrixStageNames('train', matrixAxes)

    expect(names).toHaveLength(3)
    expect(names).toContain('train@cnn')
    expect(names).toContain('train@xgb')
    expect(names).toContain('train@rf')
  })

  it('should handle three-axis matrix', () => {
    const matrixAxes = {
      a: ['1', '2'],
      b: ['x', 'y'],
      c: ['p', 'q']
    }

    const names = resolveMatrixStageNames('stage', matrixAxes)

    expect(names).toHaveLength(8)
    expect(names).toContain('stage@1-x-p')
  })
})

describe('resolveForeachStageNames', () => {
  it('should generate names for list items', () => {
    const items = ['raw1', 'raw2', 'raw3']

    const names = resolveForeachStageNames('process', items)

    expect(names).toHaveLength(3)
    expect(names).toStrictEqual([
      'process@raw1',
      'process@raw2',
      'process@raw3'
    ])
  })

  it('should handle dictionary keys', () => {
    const items = ['us', 'uk', 'de']

    const names = resolveForeachStageNames('process', items)

    expect(names).toHaveLength(3)
    expect(names).toStrictEqual(['process@us', 'process@uk', 'process@de'])
  })

  it('should handle numeric items', () => {
    const items = ['0', '1', '2']

    const names = resolveForeachStageNames('stage', items)

    expect(names).toStrictEqual(['stage@0', 'stage@1', 'stage@2'])
  })
})
