import { basename, dirname } from 'path'
import {
  CodeLens,
  CodeLensProvider,
  Event,
  EventEmitter,
  Range,
  TextDocument
} from 'vscode'
import { parseStagesFromYaml, StageType } from './parse'
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
  public readonly onDidChangeCodeLenses: Event<void>

  private readonly onDidChangeCodeLensesEmitter: EventEmitter<void>

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
        cmd: stage.cmd,
        cwd,
        foreachItems: stage.foreachItems,
        matrixAxes: stage.matrixAxes,
        stageName: stage.name,
        type: stage.type
      }

      const isGroupStage =
        stage.type === StageType.MATRIX || stage.type === StageType.FOREACH

      codeLenses.push(
        new CodeLens(range, {
          arguments: [commandArg],
          command: 'dvc.stage.run',
          title: isGroupStage ? '$(run-all) Run All' : '$(play) Run'
        }),
        new CodeLens(range, {
          arguments: [commandArg],
          command: 'dvc.stage.showActions',
          title: '$(ellipsis) More'
        })
      )
    }

    return codeLenses
  }
}
