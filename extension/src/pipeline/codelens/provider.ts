import {
  CodeLens,
  CodeLensProvider,
  Range,
  TextDocument,
  Event,
  EventEmitter
} from 'vscode'
import { dirname, basename } from 'path'
import { parseStagesFromYaml, StageInfo, StageType } from './parse'
import { Disposable } from '../../class/dispose'

export interface StageCommandArg {
  stageName: string
  cwd: string
  cmd?: string
  type: StageType
  matrixAxes?: Record<string, string[]>
  foreachItems?: string[]
}

export class StageCodeLensProvider
  extends Disposable
  implements CodeLensProvider
{
  private readonly onDidChangeCodeLensesEmitter: EventEmitter<void>
  public readonly onDidChangeCodeLenses: Event<void>

  constructor() {
    super()
    this.onDidChangeCodeLensesEmitter = this.dispose.track(new EventEmitter())
    this.onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event
  }

  public refresh(): void {
    this.onDidChangeCodeLensesEmitter.fire()
  }

  public provideCodeLenses(document: TextDocument): CodeLens[] {
    if (basename(document.fileName) !== 'dvc.yaml') {
      return []
    }

    const content = document.getText()
    const stages = parseStagesFromYaml(content)
    const cwd = dirname(document.uri.fsPath)

    const codeLenses: CodeLens[] = []

    for (const stage of stages) {
      const line = stage.lineNumber - 1
      const range = new Range(line, 0, line, 0)

      const commandArg: StageCommandArg = {
        stageName: stage.name,
        cwd,
        cmd: stage.cmd,
        type: stage.type,
        matrixAxes: stage.matrixAxes,
        foreachItems: stage.foreachItems
      }

      const isGroupStage =
        stage.type === StageType.MATRIX || stage.type === StageType.FOREACH

      codeLenses.push(
        new CodeLens(range, {
          title: isGroupStage ? '$(run-all) Run All' : '$(play) Run',
          command: 'dvc.stage.run',
          arguments: [commandArg]
        })
      )

      codeLenses.push(
        new CodeLens(range, {
          title: '$(ellipsis) More',
          command: 'dvc.stage.showActions',
          arguments: [commandArg]
        })
      )
    }

    return codeLenses
  }
}




