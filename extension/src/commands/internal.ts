import { commands } from 'vscode'
import { RegisteredCliCommands, RegisteredCommands } from './external'
import { ICli } from '../cli'
import { Args } from '../cli/constants'
import { autoRegisteredCommands as DvcConfigCommands } from '../cli/dvc/config'
import { autoRegisteredCommands as DvcExecutorCommands } from '../cli/dvc/executor'
import { autoRegisteredCommands as DvcReaderCommands } from '../cli/dvc/reader'
import { autoRegisteredCommands as DvcRunnerCommands } from '../cli/dvc/runner'
import { autoRegisteredCommands as DvcViewerCommands } from '../cli/dvc/viewer'
import { autoRegisteredCommands as GitExecutorCommands } from '../cli/git/executor'
import { autoRegisteredCommands as GitReaderCommands } from '../cli/git/reader'
import { sendTelemetryEvent, sendTelemetryEventAndThrow } from '../telemetry'
import { StopWatch } from '../util/time'
import { OutputChannel } from '../vscode/outputChannel'
import { Toast } from '../vscode/toast'
import { Response } from '../vscode/response'
import { Disposable } from '../class/dispose'

type Command = (...args: Args) => unknown

export const AvailableCommands = Object.assign(
  {},
  DvcConfigCommands,
  DvcExecutorCommands,
  DvcReaderCommands,
  DvcRunnerCommands,
  DvcViewerCommands,
  GitExecutorCommands,
  GitReaderCommands
) as typeof DvcConfigCommands &
  typeof DvcExecutorCommands &
  typeof DvcReaderCommands &
  typeof DvcRunnerCommands &
  typeof DvcViewerCommands &
  typeof GitExecutorCommands &
  typeof GitReaderCommands

export type CommandId =
  (typeof AvailableCommands)[keyof typeof AvailableCommands]

export class InternalCommands extends Disposable {
  private readonly commands = new Map<string, Command>()
  private readonly outputChannel: OutputChannel

  constructor(outputChannel: OutputChannel, ...cliInteractors: ICli[]) {
    super()

    for (const cli of cliInteractors) {
      this.autoRegisterCommands(cli)
    }
    this.outputChannel = outputChannel
  }

  public executeCommand<T = string>(
    commandId: CommandId,
    ...args: Args
  ): Promise<T> {
    const command = this.commands.get(commandId)
    if (!command) {
      throw new Error(`Unknown command: ${commandId}`)
    }

    return command(...args) as Promise<T>
  }

  public registerCommand(commandId: CommandId, command: Command): void {
    if (this.commands.has(commandId)) {
      throw new Error(`command '${commandId}' already exists`)
    }

    this.commands.set(commandId, command)
  }

  public registerExternalCliCommand<T = string | undefined>(
    name: RegisteredCliCommands,
    func: (arg: T) => unknown
  ): void {
    this.dispose.track(
      commands.registerCommand(name, async (arg: T) => {
        try {
          return await this.runAndSendTelemetry<T>(name, func, arg)
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('CLI command failed:', name, error)
          void this.offerToShowError()
        }
      })
    )
  }

  public registerExternalCommand<T = string | undefined>(
    name: RegisteredCommands,
    func: (arg: T) => unknown
  ): void {
    this.dispose.track(
      commands.registerCommand(name, (arg: T) =>
        this.runAndSendTelemetry<T>(name, func, arg)
      )
    )
  }

  private async runAndSendTelemetry<T>(
    name: RegisteredCommands | RegisteredCliCommands,
    func: (arg: T) => unknown,
    arg: T
  ) {
    const stopWatch = new StopWatch()
    try {
      const res = await func(arg)
      sendTelemetryEvent(name, undefined, {
        duration: stopWatch.getElapsedTime()
      })
      return res
    } catch (error: unknown) {
      return sendTelemetryEventAndThrow(
        name,
        error as Error,
        stopWatch.getElapsedTime()
      )
    }
  }

  private autoRegisterCommands(cli: ICli) {
    for (const commandId of cli.autoRegisteredCommands) {
      if (!this.confirmedId(commandId)) {
        throw new Error(
          'This should be an impossible error. ' +
            'If you are a user and see this message then you win a prize.'
        )
      }
      this.registerCommand(
        commandId,
        (...args: Args): Promise<string> =>
          (cli[commandId as keyof typeof cli] as Function)(...args)
      )
    }
  }

  private confirmedId(commandId: string): commandId is CommandId {
    return Object.values(AvailableCommands).includes(commandId as CommandId)
  }

  private async offerToShowError() {
    const response = await Toast.errorWithOptions(
      'Something went wrong, please see the DVC output channel for more details.',
      Response.SHOW,
      Response.CLOSE
    )
    if (response === Response.SHOW) {
      return this.outputChannel.show()
    }
  }
}
