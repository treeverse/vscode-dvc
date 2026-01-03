import { env, QuickPickItem, window } from 'vscode'
import { StageType } from './parse'
import { StageCommandArg } from './provider'
import { StageRunner } from './runner'
import { Disposable } from '../../class/dispose'
import { RegisteredCommands } from '../../commands/external'
import { InternalCommands } from '../../commands/internal'

enum ActionType {
  RUN_STAGE = 'runStage',
  CHECK_STATUS = 'checkStatus',
  COPY_STAGE_NAME = 'copyStageName',
  COPY_COMMAND = 'copyCommand',
  RUN_SPECIFIC = 'runSpecific',
  STATUS_SPECIFIC = 'statusSpecific',
  COPY_SPECIFIC_NAME = 'copySpecificName',
  COPY_SPECIFIC_CMD = 'copySpecificCmd'
}

interface ActionItem extends QuickPickItem {
  action: ActionType
  stageName?: string
}

const copyToClipboard = async (text: string): Promise<void> => {
  await env.clipboard.writeText(text)
  void window.showInformationMessage(`Copied: ${text}`)
}

const copyCommandToClipboard = async (
  arg: StageCommandArg,
  stageRunner: StageRunner
): Promise<void> => {
  const resolvedCmd = await stageRunner.getResolvedCommand(
    arg.cwd,
    arg.stageName
  )
  if (resolvedCmd) {
    await copyToClipboard(resolvedCmd)
  } else if (arg.cmd) {
    await copyToClipboard(arg.cmd)
  } else {
    void window.showWarningMessage('Could not get command for this stage')
  }
}

const copySpecificCommandToClipboard = async (
  cwd: string,
  stageName: string,
  stageRunner: StageRunner
): Promise<void> => {
  const resolvedCmd = await stageRunner.getResolvedCommand(cwd, stageName)
  if (resolvedCmd) {
    await copyToClipboard(resolvedCmd)
  } else {
    void window.showWarningMessage(
      `Could not get resolved command for ${stageName}`
    )
  }
}

const buildQuickPickItems = (
  arg: StageCommandArg,
  isGroupStage: boolean,
  resolvedNames: string[]
): ActionItem[] => {
  const items: ActionItem[] = [
    {
      action: ActionType.RUN_STAGE,
      description: `dvc repro ${arg.stageName}`,
      label: isGroupStage ? '$(run-all) Run All' : '$(play) Run Stage'
    },
    {
      action: ActionType.CHECK_STATUS,
      description: `dvc status ${arg.stageName}`,
      label: '$(search) Check Status'
    },
    {
      action: ActionType.COPY_STAGE_NAME,
      description: arg.stageName,
      label: '$(clippy) Copy Stage Name'
    }
  ]

  if (!isGroupStage && arg.cmd) {
    items.push({
      action: ActionType.COPY_COMMAND,
      description: arg.cmd,
      label: '$(copy) Copy Command'
    })
  }

  if (isGroupStage) {
    items.push({
      action: ActionType.RUN_STAGE,
      kind: -1,
      label: 'Sub-stages'
    } as ActionItem)

    for (const name of resolvedNames) {
      items.push(
        {
          action: ActionType.RUN_SPECIFIC,
          description: `dvc repro ${name}`,
          label: `$(play) Run ${name}`,
          stageName: name
        },
        {
          action: ActionType.STATUS_SPECIFIC,
          description: `dvc status ${name}`,
          label: `$(search) Status ${name}`,
          stageName: name
        },
        {
          action: ActionType.COPY_SPECIFIC_NAME,
          description: name,
          label: `$(clippy) Copy Name: ${name}`,
          stageName: name
        },
        {
          action: ActionType.COPY_SPECIFIC_CMD,
          description: '(fetches resolved command from DVC)',
          label: `$(copy) Copy Cmd: ${name}`,
          stageName: name
        }
      )
    }
  }

  return items
}

const handleAction = async (
  selected: ActionItem,
  arg: StageCommandArg,
  stageRunner: StageRunner
): Promise<void> => {
  switch (selected.action) {
    case ActionType.RUN_STAGE:
      stageRunner.runStage(arg)
      break
    case ActionType.CHECK_STATUS:
      stageRunner.runStageStatus(arg)
      break
    case ActionType.COPY_STAGE_NAME:
      await copyToClipboard(arg.stageName)
      break
    case ActionType.COPY_COMMAND:
      await copyCommandToClipboard(arg, stageRunner)
      break
    case ActionType.RUN_SPECIFIC:
      stageRunner.runSpecificStage(arg, selected.stageName!)
      break
    case ActionType.STATUS_SPECIFIC:
      stageRunner.runSpecificStageStatus(arg, selected.stageName!)
      break
    case ActionType.COPY_SPECIFIC_NAME:
      await copyToClipboard(selected.stageName!)
      break
    case ActionType.COPY_SPECIFIC_CMD:
      await copySpecificCommandToClipboard(
        arg.cwd,
        selected.stageName!,
        stageRunner
      )
      break
  }
}

export const registerStageCommands = (
  stageRunner: StageRunner,
  internalCommands: InternalCommands,
  disposable: Disposable
): void => {
  disposable.dispose.track(
    internalCommands.registerExternalCommand(
      RegisteredCommands.STAGE_RUN,
      (arg: StageCommandArg) => stageRunner.runStage(arg)
    )
  )

  disposable.dispose.track(
    internalCommands.registerExternalCommand(
      RegisteredCommands.STAGE_STATUS,
      (arg: StageCommandArg) => stageRunner.runStageStatus(arg)
    )
  )

  disposable.dispose.track(
    internalCommands.registerExternalCommand(
      RegisteredCommands.STAGE_COPY_COMMAND,
      (arg: StageCommandArg) => copyCommandToClipboard(arg, stageRunner)
    )
  )

  disposable.dispose.track(
    internalCommands.registerExternalCommand(
      RegisteredCommands.STAGE_RUN_SINGLE,
      (arg: StageCommandArg & { specificStageName: string }) =>
        stageRunner.runSpecificStage(arg, arg.specificStageName)
    )
  )

  disposable.dispose.track(
    internalCommands.registerExternalCommand(
      RegisteredCommands.STAGE_SHOW_ACTIONS,
      async (arg: StageCommandArg) => {
        const isGroupStage =
          arg.type === StageType.MATRIX || arg.type === StageType.FOREACH
        const resolvedNames = isGroupStage
          ? stageRunner.getResolvedSubStageNames(arg)
          : []

        const items = buildQuickPickItems(arg, isGroupStage, resolvedNames)

        const selected = await window.showQuickPick(items, {
          placeHolder: `Actions for stage: ${arg.stageName}`
        })

        if (selected) {
          await handleAction(selected, arg, stageRunner)
        }
      }
    )
  )
}
