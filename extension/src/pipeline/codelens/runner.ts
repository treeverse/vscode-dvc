import { Event, EventEmitter, Terminal, window } from 'vscode'
import { Disposable } from '../../class/dispose'
import { getOptions } from '../../cli/dvc/options'
import {
  AvailableCommands,
  InternalCommands
} from '../../commands/internal'
import { Config } from '../../config'
import {
  resolveForeachStageNames,
  resolveMatrixStageNames,
  StageType
} from './parse'
import { StageCommandArg } from './provider'

export class StageRunner extends Disposable {
  private readonly processCompleted: EventEmitter<void>
  public readonly onDidCompleteProcess: Event<void>
  private readonly internalCommands: InternalCommands
  private readonly config: Config

  constructor(config: Config, internalCommands: InternalCommands) {
    super()
    this.config = config
    this.internalCommands = internalCommands
    this.processCompleted = this.dispose.track(new EventEmitter())
    this.onDidCompleteProcess = this.processCompleted.event
  }

  public runStage(arg: StageCommandArg): void {
    const stageName = this.getFullStageName(arg)
    const command = this.buildCommand('repro', stageName, arg.cwd)
    this.runInTerminal(command, arg.cwd, `DVC: ${stageName}`)
  }

  public runStageStatus(arg: StageCommandArg): void {
    const stageName = this.getFullStageName(arg)
    const command = this.buildCommand('status', stageName, arg.cwd)
    this.runInTerminal(command, arg.cwd, `DVC Status: ${stageName}`)
  }

  public runSpecificStage(
    arg: StageCommandArg,
    specificStageName: string
  ): void {
    const command = this.buildCommand('repro', specificStageName, arg.cwd)
    this.runInTerminal(command, arg.cwd, `DVC: ${specificStageName}`)
  }

  public runSpecificStageStatus(
    arg: StageCommandArg,
    specificStageName: string
  ): void {
    const command = this.buildCommand('status', specificStageName, arg.cwd)
    this.runInTerminal(command, arg.cwd, `DVC Status: ${specificStageName}`)
  }

  public getResolvedSubStageNames(arg: StageCommandArg): string[] {
    if (arg.type === StageType.MATRIX && arg.matrixAxes) {
      return resolveMatrixStageNames(arg.stageName, arg.matrixAxes)
    }
    if (arg.type === StageType.FOREACH && arg.foreachItems) {
      return resolveForeachStageNames(arg.stageName, arg.foreachItems)
    }
    return [arg.stageName]
  }

  public async getResolvedCommand(
    cwd: string,
    stageName: string
  ): Promise<string | undefined> {
    try {
      const output = await this.internalCommands.executeCommand(
        AvailableCommands.REPRO_DRY,
        cwd,
        stageName
      )
      // Parse the output to extract the command
      // DVC repro --dry output format: "Running stage '<stage>':\n> <command>"
      const match = output.match(/^>\s*(.+)$/m)
      return match ? match[1].trim() : undefined
    } catch {
      return undefined
    }
  }

  private getFullStageName(arg: StageCommandArg): string {
    return arg.stageName
  }

  private buildCommand(
    dvcCommand: string,
    stageName: string,
    cwd: string
  ): string {
    const options = getOptions({
      PYTHONPATH: this.config.getPYTHONPATH(),
      cliPath: this.config.getCliPath(),
      cwd,
      pythonBinPath: this.config.getPythonBinPath()
    })
    const argsStr = options.args.length > 0 ? options.args.join(' ') + ' ' : ''
    return `${options.executable} ${argsStr}${dvcCommand} ${stageName}`
  }

  private runInTerminal(command: string, cwd: string, name: string): Terminal {
    const options = getOptions({
      PYTHONPATH: this.config.getPYTHONPATH(),
      cliPath: this.config.getCliPath(),
      cwd,
      pythonBinPath: this.config.getPythonBinPath()
    })
    const terminal = window.createTerminal({
      name,
      cwd,
      env: options.env
    })
    terminal.show()
    terminal.sendText(command)
    return terminal
  }
}




