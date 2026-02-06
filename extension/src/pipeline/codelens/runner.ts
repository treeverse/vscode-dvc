import { Terminal, window } from 'vscode'
import { Disposable } from '../../class/dispose'
import { getOptions } from '../../cli/dvc/options'
import { AvailableCommands, InternalCommands } from '../../commands/internal'
import { Config } from '../../config'
import {
  resolveForeachStageNames,
  resolveMatrixStageNames,
  StageType
} from './parse'
import { StageCommandArg } from './provider'

export class StageRunner extends Disposable {
  private readonly internalCommands: InternalCommands
  private readonly config: Config

  constructor(config: Config, internalCommands: InternalCommands) {
    super()
    this.config = config
    this.internalCommands = internalCommands
  }

  public runStage(arg: StageCommandArg): void {
    this.runDvcCommand('repro', arg.stageName, arg.cwd)
  }

  public runStageStatus(arg: StageCommandArg): void {
    this.runDvcCommand('status', arg.stageName, arg.cwd, 'DVC Status')
  }

  public runSpecificStage(
    arg: StageCommandArg,
    specificStageName: string
  ): void {
    this.runDvcCommand('repro', specificStageName, arg.cwd)
  }

  public runSpecificStageStatus(
    arg: StageCommandArg,
    specificStageName: string
  ): void {
    this.runDvcCommand('status', specificStageName, arg.cwd, 'DVC Status')
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
      const match = output.match(/^>\s*(.+)$/m)
      return match ? match[1].trim() : undefined
    } catch {
      return undefined
    }
  }

  private runDvcCommand(
    dvcCommand: string,
    stageName: string,
    cwd: string,
    terminalPrefix = 'DVC'
  ): Terminal {
    const options = this.getOptions(cwd)
    const argsStr = options.args.length > 0 ? options.args.join(' ') + ' ' : ''
    const command = `${options.executable} ${argsStr}${dvcCommand} ${stageName}`

    const terminal = window.createTerminal({
      cwd,
      env: options.env,
      name: `${terminalPrefix}: ${stageName}`
    })
    terminal.show()
    terminal.sendText(command)
    return terminal
  }

  private getOptions(cwd: string) {
    return getOptions({
      PYTHONPATH: this.config.getPYTHONPATH(),
      cliPath: this.config.getCliPath(),
      cwd,
      pythonBinPath: this.config.getPythonBinPath()
    })
  }
}
