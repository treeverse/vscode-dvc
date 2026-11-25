import { dirname } from 'path'
import { Uri, workspace } from 'vscode'
import { AvailableCommands, InternalCommands } from '../commands/internal'
import { BaseData } from '../data'
import { findFiles } from '../fileSystem/workspace'
import { isPathInProject } from '../fileSystem'
import { Flag, TEMP_EXP_DIR } from '../cli/dvc/constants'
import { ConfigKey } from '../vscode/config'

export class PipelineData extends BaseData<{
  dag: string
  stages: { [pipeline: string]: string | undefined }
}> {
  private readonly subProjects: string[]
  private readonly scope: Uri
  private collapseOverride: boolean | undefined

  constructor(
    dvcRoot: string,
    internalCommands: InternalCommands,
    subProjects: string[]
  ) {
    super(
      dvcRoot,
      internalCommands,
      [{ name: 'update', process: () => this.update() }],
      subProjects,
      ['dvc.yaml']
    )

    this.subProjects = subProjects
    this.scope = Uri.file(dvcRoot)
    this.dispose.track(
      workspace.onDidChangeConfiguration(event => {
        if (
          event.affectsConfiguration(
            ConfigKey.PIPELINE_COLLAPSE_FOREACH_MATRIX,
            this.scope
          )
        ) {
          this.collapseOverride = undefined
          void this.processManager.run('update', false)
        }
      })
    )
    this.waitForInitialData()
  }

  public managedUpdate() {
    return this.processManager.run('update')
  }

  public toggleDagCollapse() {
    this.collapseOverride = !this.shouldCollapseDag()
    return this.processManager.run('update', false)
  }

  public async update(): Promise<void> {
    const collapse = this.shouldCollapseDag()
    const [dag, fileList] = await Promise.all([
      this.internalCommands.executeCommand(
        AvailableCommands.DAG,
        this.dvcRoot,
        ...(collapse ? [Flag.COLLAPSE_FOREACH_MATRIX] : [])
      ),
      this.findDvcYamls()
    ])

    const dvcYamlsDirs = new Set<string>()
    this.collectedFiles = []
    for (const file of fileList) {
      if (isPathInProject(file, this.dvcRoot, this.subProjects)) {
        this.collectedFiles.push(file)
        dvcYamlsDirs.add(dirname(file))
      }
    }

    const stages: { [dir: string]: string } = {}
    for (const dir of dvcYamlsDirs) {
      stages[dir] = await this.internalCommands.executeCommand(
        AvailableCommands.STAGE_LIST,
        dir
      )
    }

    return this.notifyChanged({ dag, stages })
  }

  private async findDvcYamls() {
    const dvcYamls = await findFiles('**/dvc.yaml')
    return dvcYamls.filter(file => !file.includes(TEMP_EXP_DIR))
  }

  private shouldCollapseDag() {
    return (
      this.collapseOverride ??
      workspace
        .getConfiguration(undefined, this.scope)
        .get(ConfigKey.PIPELINE_COLLAPSE_FOREACH_MATRIX, false)
    )
  }
}
