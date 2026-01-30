import { afterEach, beforeEach, describe, it, suite } from 'mocha'
import { expect } from 'chai'
import { commands } from 'vscode'
import { restore, stub } from 'sinon'
import { closeAllEditors } from '../util'
import { RegisteredCommands } from '../../../commands/external'

suite('Walkthrough Test Suite', () => {
  beforeEach(() => {
    restore()
  })

  afterEach(() => {
    return closeAllEditors()
  })

  describe('dvc.getStarted', () => {
    it('should be able to show the walkthrough', async () => {
      const mockExecuteCommand = stub(commands, 'executeCommand')
      mockExecuteCommand
        .onFirstCall()
        .callsFake((...args) => mockExecuteCommand.wrappedMethod(...args))
        .onSecondCall()
        .resolves(undefined)

      await expect(
        commands.executeCommand(RegisteredCommands.EXTENSION_GET_STARTED)
      ).to.be.eventually.equal(undefined)

      expect(mockExecuteCommand).to.be.calledTwice
      expect(mockExecuteCommand).to.be.calledWith(
        'workbench.action.openWalkthrough',
        'lakeFS.lakefs-dvc#welcome'
      )
    })
  })
})
