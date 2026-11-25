import isEmpty from 'lodash.isempty'
import { DvcCli } from '.'
import {
  Args,
  Command,
  ExperimentFlag,
  Flag,
  SubCommand,
  TEMP_PLOTS_DIR
} from './constants'
import {
  DataStatusOutput,
  DEFAULT_EXP_SHOW_OUTPUT,
  DvcError,
  ExpShowOutput,
  PlotsOutput,
  PlotsOutputOrError,
  RawPlotsOutput
} from './contract'
import { getOptions } from './options'
import {
  COLLAPSE_FOREACH_MATRIX_MIN_VERSION,
  supportsCollapseForeachMatrix
} from './version'
import { typeCheckCommands } from '..'
import { MaybeConsoleError } from '../error'
import { Logger } from '../../common/logger'
import { parseNonStandardJson } from '../../util/json'
import { definedAndNonEmpty } from '../../util/array'
import { Toast } from '../../vscode/toast'

export const isDvcError = <
  T extends ExpShowOutput | DataStatusOutput | RawPlotsOutput
>(
  dataOrError: T | DvcError
): dataOrError is DvcError =>
  !!(Object.keys(dataOrError).length === 1 && (dataOrError as DvcError).error)

export const autoRegisteredCommands = {
  DAG: 'dag',
  DATA_STATUS: 'dataStatus',
  EXP_SHOW: 'expShow',
  GLOBAL_VERSION: 'globalVersion',
  PLOTS_DIFF: 'plotsDiff',
  ROOT: 'root',
  STAGE_LIST: 'stageList',
  VERSION: 'version'
} as const

export class DvcReader extends DvcCli {
  public readonly autoRegisteredCommands = typeCheckCommands(
    autoRegisteredCommands,
    this
  )

  private warnedAboutDagVersion = false

  public async dag(cwd: string, collapse?: Flag.COLLAPSE_FOREACH_MATRIX) {
    try {
      const flags = [Flag.MD]
      if (collapse) {
        const version = await this.version(cwd).catch(() => '')
        if (supportsCollapseForeachMatrix(version)) {
          flags.push(collapse)
        } else if (version && !this.warnedAboutDagVersion) {
          this.warnedAboutDagVersion = true
          void Toast.warnWithOptions(
            `Collapsing foreach and matrix stages requires DVC ${COLLAPSE_FOREACH_MATRIX_MIN_VERSION} or newer. Showing the expanded DAG.`
          )
        }
      }
      return await this.executeDvcProcess(cwd, Command.DAG, ...flags)
    } catch (error: unknown) {
      return (error as Error).toString()
    }
  }

  public dataStatus(
    cwd: string,
    ...args: Args
  ): Promise<DataStatusOutput | DvcError> {
    return this.readProcessJson<DataStatusOutput>(
      cwd,
      Command.DATA,
      SubCommand.STATUS,
      Flag.GRANULAR,
      Flag.UNCHANGED,
      ...args
    )
  }

  public async expShow(
    cwd: string,
    ...flags: (ExperimentFlag | string)[]
  ): Promise<ExpShowOutput> {
    const output = await this.readProcess<ExpShowOutput>(
      cwd,
      JSON.stringify([]),
      Command.EXPERIMENT,
      SubCommand.SHOW,
      ...flags,
      Flag.JSON
    )
    if (isDvcError(output) || isEmpty(output)) {
      return [
        {
          ...DEFAULT_EXP_SHOW_OUTPUT[0],
          ...(output as DvcError)
        }
      ]
    }
    return output
  }

  public async plotsDiff(
    cwd: string,
    ...revisions: string[]
  ): Promise<PlotsOutputOrError> {
    const output = await this.readProcessJson<RawPlotsOutput>(
      cwd,
      Command.PLOTS,
      SubCommand.DIFF,
      ...revisions,
      Flag.OUTPUT_PATH,
      TEMP_PLOTS_DIR,
      Flag.SPLIT
    )
    if (isDvcError(output)) {
      return output
    }

    const { data, errors } = output
    const expectedOutput: PlotsOutput = {
      data: data || {}
    }

    if (definedAndNonEmpty(errors)) {
      expectedOutput.errors = errors
    }

    return expectedOutput
  }

  public async root(cwd: string): Promise<string | undefined> {
    try {
      return await this.executeDvcProcess(cwd, Command.ROOT)
    } catch {}
  }

  public version(cwd: string): Promise<string> {
    return this.executeDvcProcess(cwd, Flag.VERSION)
  }

  public globalVersion(cwd: string): Promise<string> {
    const options = getOptions({
      PYTHONPATH: undefined,
      args: [Flag.VERSION],
      cliPath: this.extensionConfig.getCliPath(),
      cwd,
      pythonBinPath: undefined
    })

    return this.executeProcess(options)
  }

  public async stageList(cwd: string): Promise<string | undefined> {
    try {
      return await this.executeDvcProcess(cwd, Command.STAGE, SubCommand.LIST)
    } catch {}
  }

  private readProcessJson<T extends DataStatusOutput | RawPlotsOutput>(
    cwd: string,
    command: Command,
    ...args: Args
  ) {
    return this.readProcess<T>(cwd, '{}', command, ...args, Flag.JSON)
  }

  private async readProcess<
    T extends DataStatusOutput | ExpShowOutput | RawPlotsOutput
  >(cwd: string, defaultValue: string, ...args: Args): Promise<T | DvcError> {
    try {
      const output =
        (await this.executeDvcProcess(cwd, ...args)) || defaultValue
      return parseNonStandardJson<T>(output)
    } catch (error: unknown) {
      const msg =
        (error as MaybeConsoleError).stderr || (error as Error).message
      Logger.error(`${args.join(' ')} failed with ${msg}`)
      return { error: { msg, type: 'Caught error' } }
    }
  }
}
