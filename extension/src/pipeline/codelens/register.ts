import { env, QuickPickItem, window } from 'vscode'
import { Disposable } from '../../class/dispose'
import { RegisteredCommands } from '../../commands/external'
import { InternalCommands } from '../../commands/internal'
import { StageType } from './parse'
import { StageCommandArg } from './provider'
import { StageRunner } from './runner'

export const registerStageCommands = (
  stageRunner: StageRunner,
  internalCommands: InternalCommands,
  disposable: Disposable
): void => {
  disposable.dispose.track(
    internalCommands.registerExternalCommand(
      RegisteredCommands.STAGE_RUN,
      (arg: StageCommandArg) => {
        stageRunner.runStage(arg)
      }
    )
  )

  disposable.dispose.track(
    internalCommands.registerExternalCommand(
      RegisteredCommands.STAGE_STATUS,
      (arg: StageCommandArg) => {
        stageRunner.runStageStatus(arg)
      }
    )
  )

  disposable.dispose.track(
    internalCommands.registerExternalCommand(
      RegisteredCommands.STAGE_COPY_COMMAND,
      async (arg: StageCommandArg) => {
        const resolvedCmd = await stageRunner.getResolvedCommand(
          arg.cwd,
          arg.stageName
        )
        if (resolvedCmd) {
          await env.clipboard.writeText(resolvedCmd)
          void window.showInformationMessage(`Copied: ${resolvedCmd}`)
        } else if (arg.cmd) {
          await env.clipboard.writeText(arg.cmd)
          void window.showInformationMessage(`Copied: ${arg.cmd}`)
        } else {
          void window.showWarningMessage('No command found for this stage')
        }
      }
    )
  )

  disposable.dispose.track(
    internalCommands.registerExternalCommand(
      RegisteredCommands.STAGE_RUN_SINGLE,
      (arg: StageCommandArg & { specificStageName: string }) => {
        stageRunner.runSpecificStage(arg, arg.specificStageName)
      }
    )
  )

  disposable.dispose.track(
    internalCommands.registerExternalCommand(
      RegisteredCommands.STAGE_SHOW_ACTIONS,
      async (arg: StageCommandArg) => {
        const isGroupStage =
          arg.type === StageType.MATRIX || arg.type === StageType.FOREACH

        const items: QuickPickItem[] = [
          {
            label: isGroupStage ? '$(run-all) Run All' : '$(play) Run Stage',
            description: `dvc repro ${arg.stageName}`
          },
          {
            label: '$(search) Check Status',
            description: `dvc status ${arg.stageName}`
          },
          {
            label: '$(clippy) Copy Stage Name',
            description: arg.stageName
          }
        ]

        if (!isGroupStage && arg.cmd) {
          items.push({
            label: '$(copy) Copy Command',
            description: arg.cmd
          })
        }

        if (isGroupStage) {
          const resolvedNames = stageRunner.getResolvedSubStageNames(arg)
          items.push({
            label: 'Sub-stages',
            kind: -1
          } as QuickPickItem)

          for (const name of resolvedNames) {
            items.push({
              label: `$(play) Run ${name}`,
              description: `dvc repro ${name}`
            })
            items.push({
              label: `$(search) Status ${name}`,
              description: `dvc status ${name}`
            })
            items.push({
              label: `$(clippy) Copy Name: ${name}`,
              description: name
            })
            items.push({
              label: `$(copy) Copy Cmd: ${name}`,
              description: '(fetches resolved command from DVC)'
            })
          }
        }

        const selected = await window.showQuickPick(items, {
          placeHolder: `Actions for stage: ${arg.stageName}`
        })

        if (!selected) {
          return
        }

        if (
          selected.label.includes('Run All') ||
          selected.label === '$(play) Run Stage'
        ) {
          stageRunner.runStage(arg)
        } else if (selected.label === '$(search) Check Status') {
          stageRunner.runStageStatus(arg)
        } else if (selected.label === '$(clippy) Copy Stage Name') {
          await env.clipboard.writeText(arg.stageName)
          void window.showInformationMessage(`Copied: ${arg.stageName}`)
        } else if (selected.label === '$(copy) Copy Command') {
          const resolvedCmd = await stageRunner.getResolvedCommand(
            arg.cwd,
            arg.stageName
          )
          if (resolvedCmd) {
            await env.clipboard.writeText(resolvedCmd)
            void window.showInformationMessage(`Copied: ${resolvedCmd}`)
          } else if (arg.cmd) {
            // Fallback to the cmd from yaml if DVC fails
            await env.clipboard.writeText(arg.cmd)
            void window.showInformationMessage(`Copied: ${arg.cmd}`)
          } else {
            void window.showWarningMessage('Could not get command for this stage')
          }
        } else if (selected.label.startsWith('$(play) Run ')) {
          const stageName = selected.label.replace('$(play) Run ', '')
          stageRunner.runSpecificStage(arg, stageName)
        } else if (selected.label.startsWith('$(search) Status ')) {
          const stageName = selected.label.replace('$(search) Status ', '')
          stageRunner.runSpecificStageStatus(arg, stageName)
        } else if (selected.label.startsWith('$(clippy) Copy Name: ')) {
          const stageName = selected.label.replace('$(clippy) Copy Name: ', '')
          await env.clipboard.writeText(stageName)
          void window.showInformationMessage(`Copied: ${stageName}`)
        } else if (selected.label.startsWith('$(copy) Copy Cmd: ')) {
          const stageName = selected.label.replace('$(copy) Copy Cmd: ', '')
          const resolvedCmd = await stageRunner.getResolvedCommand(
            arg.cwd,
            stageName
          )
          if (resolvedCmd) {
            await env.clipboard.writeText(resolvedCmd)
            void window.showInformationMessage(`Copied: ${resolvedCmd}`)
          } else {
            void window.showWarningMessage(
              `Could not get resolved command for ${stageName}`
            )
          }
        }
      }
    )
  )
}


