import { join } from 'path'
import { afterEach, beforeEach, describe, it, suite } from 'mocha'
import { expect } from 'chai'
import { restore, spy, stub } from 'sinon'
import { commands } from 'vscode'
import { closeAllEditors } from '../util'
import { dvcDemoPath } from '../../util'
import { WEBVIEW_TEST_TIMEOUT } from '../timeouts'
import { RegisteredCommands } from '../../../commands/external'
import { WorkspacePipeline } from '../../../pipeline/workspace'
import { standardizePath } from '../../../fileSystem/path'

suite('Workspace Pipeline Test Suite', () => {
  beforeEach(() => {
    restore()
  })

  afterEach(() => {
    return closeAllEditors()
  })

  describe('WorkspacePipeline', () => {
    it("should be able to show the demo project's DAG", async () => {
      const executeCommandSpy = spy(commands, 'executeCommand')

      stub(WorkspacePipeline.prototype, 'getDvcRoots').returns([dvcDemoPath])

      await commands.executeCommand(RegisteredCommands.PIPELINE_SHOW_DAG)

      expect(executeCommandSpy.lastCall.args[0]).to.be.oneOf([
        'markdown.showPreview',
        'vscode.openWith'
      ])
      expect(executeCommandSpy.lastCall.args[1].fsPath).to.equal(
        standardizePath(join(dvcDemoPath, '.dvc', 'tmp', 'dag.md'))
      )
    }).timeout(WEBVIEW_TEST_TIMEOUT)
  })
})
