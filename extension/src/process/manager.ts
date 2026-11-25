import { getCurrentEpoch } from '../util/time'
import { Disposable } from '../class/dispose'

export const DEFAULT_DEBOUNCE_WINDOW_MS = 200

export class ProcessManager extends Disposable {
  private processes: Record<
    string,
    { process: () => Promise<unknown>; lastStarted?: number }
  > = {}

  private queued = new Set<string>()
  private locked = new Set<string>()

  constructor(
    ...processes: { name: string; process: () => Promise<unknown> }[]
  ) {
    super()

    for (const { name, process } of processes) {
      this.processes[name] = { process }
    }
  }

  public async run(name: string, debounce = true): Promise<void> {
    this.checkCanRun(name)
    if (!debounce) {
      delete this.processes[name].lastStarted
    }
    const { process, lastStarted } = this.processes[name]

    if (this.shouldDebounce(lastStarted)) {
      return
    }

    if (this.anyOngoing()) {
      return this.queue(name)
    }

    this.lock(name)
    await Promise.all([process(), this.setLastStarted(name)])
    this.unlock(name)

    return this.runQueued()
  }

  public isOngoingOrQueued(name: string) {
    return this.isOngoing(name) || this.isQueued(name)
  }

  private queue(name: string): Promise<void> {
    this.queued.add(name)
    return Promise.resolve()
  }

  private shouldDebounce(lastStarted: number | undefined) {
    return (
      lastStarted &&
      getCurrentEpoch() - lastStarted < DEFAULT_DEBOUNCE_WINDOW_MS
    )
  }

  private setLastStarted(name: string) {
    this.processes[name].lastStarted = getCurrentEpoch()
  }

  private anyOngoing(): boolean {
    return this.locked.size > 0
  }

  private runQueued(): Promise<void> {
    const next = this.getNextFromQueue()
    if (!next || this.dispose.disposed) {
      return Promise.resolve()
    }

    return this.run(next)
  }

  private getNextFromQueue(): string | undefined {
    const next = this.queued.values().next().value as string
    if (!next) {
      return
    }
    this.queued.delete(next)
    return next
  }

  private isOngoing(name: string) {
    return this.locked.has(name)
  }

  private isQueued(name: string): boolean {
    return this.queued.has(name)
  }

  private lock(name: string) {
    return this.locked.add(name)
  }

  private unlock(name: string) {
    return this.locked.delete(name)
  }

  private checkCanRun(name: string) {
    if (!this.processes[name]) {
      throw new Error('looking for an item to retry that does not exist')
    }
  }
}
