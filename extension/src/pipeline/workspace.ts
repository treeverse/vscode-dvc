import { join } from 'path'
import { commands, extensions, TabInputCustom, Uri, window } from 'vscode'
import { Pipeline } from '.'
import { TEMP_DAG_FILE } from '../cli/dvc/constants'
import { BaseWorkspace } from '../workspace'
import {
  MARKDOWN_MERMAID_EXTENSION_ID,
  recommendMermaidSupportExtension
} from '../vscode/recommend'
import { InternalCommands } from '../commands/internal'
import { getOnDidChangeExtensions, isInstalled } from '../vscode/extensions'

const MARKDOWN_PREVIEW_EDITOR = 'vscode.markdown.preview.editor'

export class WorkspacePipeline extends BaseWorkspace<Pipeline> {
  private isMermaidSupportInstalled = isInstalled(MARKDOWN_MERMAID_EXTENSION_ID)

  private focusedProject: string | undefined

  constructor(internalCommands: InternalCommands) {
    super(internalCommands)

    const onDidChangeExtensions = getOnDidChangeExtensions()
    this.dispose.track(
      onDidChangeExtensions(() => {
        const wasMermaidInstalled = this.isMermaidSupportInstalled
        this.isMermaidSupportInstalled = isInstalled(
          MARKDOWN_MERMAID_EXTENSION_ID
        )
        if (!wasMermaidInstalled && this.isMermaidSupportInstalled) {
          this.renderDagAsMermaid()
        }
      })
    )
  }

  public createRepository(dvcRoot: string, subProjects: string[]) {
    const pipeline = this.dispose.track(
      new Pipeline(dvcRoot, this.internalCommands, subProjects)
    )

    this.setRepository(dvcRoot, pipeline)

    this.dispose.track(
      pipeline.onDidFocusProject(project => {
        this.focusedProject = project
      })
    )

    return pipeline
  }

  public async showDag() {
    const cwd = await this.getCwd()

    if (!cwd) {
      return
    }

    void recommendMermaidSupportExtension()

    const dag = Uri.file(join(cwd, TEMP_DAG_FILE))
    const markdown = extensions.getExtension(
      'vscode.markdown-language-features'
    )
    const manifest = markdown?.packageJSON as
      | { contributes?: { customEditors?: { viewType: string }[] } }
      | undefined
    const customEditors = manifest?.contributes?.customEditors
    if (
      customEditors?.some(editor => editor.viewType === MARKDOWN_PREVIEW_EDITOR)
    ) {
      return commands.executeCommand(
        'vscode.openWith',
        dag,
        MARKDOWN_PREVIEW_EDITOR
      )
    }

    return commands.executeCommand('markdown.showPreview', dag)
  }

  public async toggleDagCollapse() {
    const input = window.tabGroups.activeTabGroup.activeTab?.input
    const previewRoot =
      input instanceof TabInputCustom &&
      input.viewType === MARKDOWN_PREVIEW_EDITOR
        ? this.getDvcRoots().find(
            root =>
              Uri.file(join(root, TEMP_DAG_FILE)).toString() ===
              input.uri.toString()
          )
        : undefined
    const cwd = previewRoot ?? (await this.getCwd())
    if (cwd) {
      return this.getRepository(cwd).toggleDagCollapse()
    }
  }

  public async addDataSeriesPlot(overrideRoot?: string) {
    const cwd = overrideRoot || (await this.getCwd())

    if (!cwd) {
      return
    }

    void this.getRepository(cwd).addDataSeriesPlot()
  }

  private getCwd() {
    return this.focusedProject || this.getOnlyOrPickProject()
  }

  private renderDagAsMermaid() {
    for (const dvcRoot of this.getDvcRoots()) {
      void this.getRepository(dvcRoot).forceRerender()
    }
  }
}
