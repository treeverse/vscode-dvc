import { ProcessManager } from './manager'

jest.unmock('@hediet/std/disposable')

describe('ProcessManager', () => {
  it('queues immediate requests even during the debounce interval', async () => {
    let finishFirst: () => void = () => undefined
    const firstUpdate = new Promise<void>(resolve => {
      finishFirst = resolve
    })
    const process = jest.fn(async () => {}).mockReturnValueOnce(firstUpdate)
    const manager = new ProcessManager({ name: 'update', process })

    const running = manager.run('update')
    await manager.run('update', false)
    await manager.run('update', false)
    expect(process).toHaveBeenCalledTimes(1)

    finishFirst()
    await running
    expect(process).toHaveBeenCalledTimes(2)
    manager.dispose()
  })
})
