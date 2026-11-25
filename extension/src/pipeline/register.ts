import { WorkspacePipeline } from './workspace'
import { RegisteredCommands } from '../commands/external'
import { InternalCommands } from '../commands/internal'

export const registerPipelineCommands = (
  pipelines: WorkspacePipeline,
  internalCommands: InternalCommands
): void => {
  internalCommands.registerExternalCommand(
    RegisteredCommands.PIPELINE_SHOW_DAG,
    () => pipelines.showDag()
  )
  internalCommands.registerExternalCommand(
    RegisteredCommands.PIPELINE_TOGGLE_DAG_COLLAPSE,
    () => pipelines.toggleDagCollapse()
  )
}
