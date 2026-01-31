import { Range, TextDocument, Uri } from 'vscode'
import { StageCodeLensProvider } from './provider'
import { parseStagesFromYaml, StageType } from './parse'

jest.mock('./parse')
jest.mock('vscode')
jest.mock('../../class/dispose', () => ({
  Disposable: class {
    dispose = {
      track: <T>(item: T) => item,
      untrack: jest.fn()
    }
  }
}))

const mockedParseStagesFromYaml = jest.mocked(parseStagesFromYaml)

const createMockDocument = (content: string, fileName = 'dvc.yaml') => {
  return {
    fileName,
    getText: () => content,
    lineAt: (line: number) => ({
      range: new Range(line, 0, line, 100)
    }),
    uri: { fsPath: `/project/${fileName}` } as Uri
  } as unknown as TextDocument
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe('StageCodeLensProvider', () => {
  describe('provideCodeLenses', () => {
    it('should return empty array for non-dvc.yaml files', () => {
      const provider = new StageCodeLensProvider()
      const document = createMockDocument('stages:\n  train:\n', 'other.yaml')

      const codeLenses = provider.provideCodeLenses(document)

      expect(codeLenses).toStrictEqual([])
    })

    it('should create CodeLens for each simple stage', () => {
      mockedParseStagesFromYaml.mockReturnValue([
        {
          cmd: 'python train.py',
          lineNumber: 2,
          name: 'train',
          type: StageType.SIMPLE
        },
        {
          cmd: 'python evaluate.py',
          lineNumber: 8,
          name: 'evaluate',
          type: StageType.SIMPLE
        }
      ])

      const provider = new StageCodeLensProvider()
      const document = createMockDocument('stages:\n  train:\n  evaluate:\n')

      const codeLenses = provider.provideCodeLenses(document)

      expect(codeLenses).toHaveLength(4)
      expect(codeLenses[0].command?.title).toContain('Run')
      expect(codeLenses[0].command?.command).toBe('dvc.stage.run')
    })

    it('should create CodeLens with run-all icon for matrix stages', () => {
      mockedParseStagesFromYaml.mockReturnValue([
        {
          cmd: 'python train.py',
          lineNumber: 2,
          matrixAxes: { model: ['cnn', 'xgb'] },
          name: 'train',
          type: StageType.MATRIX
        }
      ])

      const provider = new StageCodeLensProvider()
      const document = createMockDocument('stages:\n  train:\n')

      const codeLenses = provider.provideCodeLenses(document)

      expect(codeLenses.length).toBeGreaterThan(0)
      expect(codeLenses[0].command?.title).toContain('Run All')
    })

    it('should create CodeLens with run-all icon for foreach stages', () => {
      mockedParseStagesFromYaml.mockReturnValue([
        {
          cmd: 'python process.py',
          foreachItems: ['a', 'b', 'c'],
          lineNumber: 2,
          name: 'process',
          type: StageType.FOREACH
        }
      ])

      const provider = new StageCodeLensProvider()
      const document = createMockDocument('stages:\n  process:\n')

      const codeLenses = provider.provideCodeLenses(document)

      expect(codeLenses.length).toBeGreaterThan(0)
      expect(codeLenses[0].command?.title).toContain('Run All')
    })

    it('should include stage info in command arguments', () => {
      mockedParseStagesFromYaml.mockReturnValue([
        {
          cmd: 'python train.py',
          lineNumber: 2,
          name: 'train',
          type: StageType.SIMPLE
        }
      ])

      const provider = new StageCodeLensProvider()
      const document = createMockDocument('stages:\n  train:\n')

      const codeLenses = provider.provideCodeLenses(document)

      const runLens = codeLenses.find(
        l => l.command?.command === 'dvc.stage.run'
      )
      expect(runLens?.command?.arguments).toBeDefined()
      expect(runLens?.command?.arguments?.[0]).toMatchObject({
        cwd: '/project',
        stageName: 'train'
      })
    })

    it('should create More Actions CodeLens for each stage', () => {
      mockedParseStagesFromYaml.mockReturnValue([
        {
          cmd: 'python train.py',
          lineNumber: 2,
          name: 'train',
          type: StageType.SIMPLE
        }
      ])

      const provider = new StageCodeLensProvider()
      const document = createMockDocument('stages:\n  train:\n')

      const codeLenses = provider.provideCodeLenses(document)

      const moreActionsLens = codeLenses.find(
        l => l.command?.command === 'dvc.stage.showActions'
      )
      expect(moreActionsLens).toBeDefined()
      expect(moreActionsLens?.command?.title).toContain('More')
    })
  })
})
