import { join } from 'path'
import { Event, EventEmitter } from 'vscode'
import { appendFileSync, writeFileSync } from 'fs-extra'
import { setContextForEditorTitleIcons } from './context'
import { PipelineData } from './data'
import { PipelineModel } from './model'
import { pickPlotConfiguration } from './quickPick'
import { DeferredDisposable } from '../class/deferred'
import { InternalCommands } from '../commands/internal'
import { TEMP_DAG_FILE } from '../cli/dvc/constants'
import {
  addPlotToDvcYamlFile,
  findOrCreateDvcYamlFile,
  getFileExtension
} from '../fileSystem'
import { getInput, getValidInput } from '../vscode/inputBox'
import { Title } from '../vscode/title'
import { quickPickOne, quickPickOneOrInput } from '../vscode/quickPick'
import { pickFile } from '../vscode/resourcePicker'
import { Response } from '../vscode/response'
import { Modal } from '../vscode/modal'

export enum ScriptCommand {
  JUPYTER = 'jupyter nbconvert --to notebook --inplace --execute',
  PYTHON = 'python'
}

const getScriptCommand = (script: string) => {
  switch (getFileExtension(script)) {
    case '.py':
      return ScriptCommand.PYTHON
    case '.ipynb':
      return ScriptCommand.JUPYTER
    default:
      return ''
  }
}

export class Pipeline extends DeferredDisposable {
  public onDidUpdate: Event<void>
  public readonly onDidFocusProject: Event<string | undefined>

  private updated: EventEmitter<void>

  private focusedPipeline: string | undefined
  private readonly pipelineFileFocused: EventEmitter<string | undefined> =
    this.dispose.track(new EventEmitter())

  private readonly onDidFocusPipelineFile: Event<string | undefined> =
    this.pipelineFileFocused.event

  private projectFocused: EventEmitter<string | undefined> = this.dispose.track(
    new EventEmitter()
  )

  private readonly dvcRoot: string
  private readonly data: PipelineData
  private readonly model: PipelineModel

  constructor(
    dvcRoot: string,
    internalCommands: InternalCommands,
    subProjects: string[],
    data?: PipelineData
  ) {
    super()
    this.dvcRoot = dvcRoot
    this.data = this.dispose.track(
      data || new PipelineData(dvcRoot, internalCommands, subProjects)
    )
    this.model = this.dispose.track(new PipelineModel())
    this.updated = this.dispose.track(new EventEmitter<void>())
    this.onDidUpdate = this.updated.event

    this.onDidFocusProject = this.projectFocused.event

    void this.initialize()
    this.watchActiveEditor(subProjects)
  }

  public hasPipeline() {
    return this.model.hasPipeline()
  }

  public async getCwd() {
    await this.checkOrAddPipeline()
    return this.findPipelineCwd()
  }

  public async checkOrAddPipeline() {
    if (this.model.hasPipeline()) {
      return
    }

    const response = await Modal.showInformation(
      'To continue you must add some configuration. Would you like to add a stage now?',
      Response.YES
    )

    if (response !== Response.YES) {
      return
    }

    return this.addPipeline()
  }

  public async addPipeline() {
    const stageName = await this.askForStageName()
    if (!stageName) {
      return
    }

    const { trainingScript, command, enteredManually } =
      await this.askForTrainingScript()
    if (!trainingScript) {
      return
    }

    const dataUpdated = new Promise(resolve => {
      const listener = this.dispose.track(
        this.data.onDidUpdate(() => {
          resolve(undefined)
          this.dispose.untrack(listener)
          listener.dispose()
        })
      )
    })

    void findOrCreateDvcYamlFile(
      this.dvcRoot,
      trainingScript,
      stageName,
      command,
      !enteredManually
    )
    void this.data.managedUpdate()
    return dataUpdated
  }

  public async addDataSeriesPlot() {
    const cwd = (await this.findPipelineCwd()) || this.dvcRoot

    const plotConfiguration = await pickPlotConfiguration(cwd)

    if (!plotConfiguration) {
      return
    }

    addPlotToDvcYamlFile(cwd, plotConfiguration)
  }

  public forceRerender() {
    return appendFileSync(join(this.dvcRoot, TEMP_DAG_FILE), '\n')
  }

  public toggleDagCollapse() {
    return this.data.toggleDagCollapse()
  }

  private findPipelineCwd() {
    const focusedPipeline = this.getFocusedPipeline()
    if (focusedPipeline) {
      return focusedPipeline
    }

    const pipelines = this.model.getPipelines()
    if (!pipelines?.size) {
      return
    }
    if (pipelines.has(this.dvcRoot)) {
      return this.dvcRoot
    }
    if (pipelines.size === 1) {
      return [...pipelines][0]
    }

    return quickPickOne(
      [...pipelines],
      'Select a Pipeline to Run Command Against'
    )
  }

  private async initialize() {
    this.dispose.track(
      this.data.onDidUpdate(({ dag, stages }) => {
        this.writeDag(dag)
        const hasPipeline = this.model.hasPipeline()
        this.model.transformAndSet(stages)
        if (hasPipeline !== this.model.hasPipeline()) {
          this.updated.fire()
        }
      })
    )
    void this.data.managedUpdate()

    await this.data.isReady()
    return this.deferred.resolve()
  }

  private async askForStageName() {
    return await getValidInput(
      Title.ENTER_STAGE_NAME,
      (stageName?: string) => {
        if (!stageName) {
          return 'Stage name must not be empty'
        }
        if (!/^[a-z]/i.test(stageName)) {
          return 'Stage name should start with a letter'
        }
        return /^\w+$/.test(stageName)
          ? null
          : 'Stage name should only include letters and numbers'
      },
      { value: 'train' }
    )
  }

  private async askForTrainingScript() {
    const selectValue = 'select'
    const pathOrSelect = await quickPickOneOrInput(
      [{ label: 'Select from file explorer', value: selectValue }],
      {
        defaultValue: '',
        placeholder: 'Path to script',
        title: Title.ENTER_PATH_OR_CHOOSE_FILE
      }
    )

    const trainingScript =
      pathOrSelect === selectValue
        ? await pickFile(Title.SELECT_TRAINING_SCRIPT)
        : pathOrSelect

    if (!trainingScript) {
      return {
        command: undefined,
        enteredManually: false,
        trainingScript: undefined
      }
    }

    const command =
      getScriptCommand(trainingScript) ||
      (await getInput(Title.ENTER_COMMAND_TO_RUN)) ||
      ''
    const enteredManually = pathOrSelect !== selectValue
    return { command, enteredManually, trainingScript }
  }

  private writeDag(dag: string) {
    writeFileSync(join(this.dvcRoot, TEMP_DAG_FILE), dag)
  }

  private getFocusedPipeline() {
    return this.focusedPipeline
  }

  private watchActiveEditor(subProjects: string[]) {
    setContextForEditorTitleIcons(
      this.dvcRoot,
      this.dispose,
      this.pipelineFileFocused,
      subProjects
    )

    this.dispose.track(
      this.onDidFocusPipelineFile(cwd => {
        this.focusedPipeline = cwd
        this.projectFocused.fire(cwd && this.dvcRoot)
      })
    )
  }
}
