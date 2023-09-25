export type Subscriber<T> = (value: T) => void

export interface ObservableOptions<T> {
  hasChanged?(currentValue: T | undefined, newValue: T): boolean
  name?: string
}

export const notEqual = <T>(
  firstValue: T | undefined,
  secondValue: T | undefined
) => !Object.is(firstValue, secondValue)

/**
 * Core observable class that allows subscribing to changes,
 * reading values, and responding to changes
 */
export class Observable<T> {
  static context: Computed<any>[] = []
  static batchedUpdateChecks: null | Set<Observable<any>>
  /**
   * All subscription updates will be deferred until after passed action has run,
   * preventing a subscriber from being updated multiple times for multiple
   * writable observable write operations
   */
  static batch(action: () => void) {
    // If there is already a set, this is a nested call, don't flush until we
    // return to the top level
    const flush = !Observable.batchedUpdateChecks
    Observable.batchedUpdateChecks ??= new Set()
    action()
    if (flush) {
      Observable.batchedUpdateChecks?.forEach((observable) => {
        observable.updateSubscribers()
      })
      Observable.batchedUpdateChecks = null
    }
  }

  constructor(
    protected _value: T,
    protected _options: ObservableOptions<T> = {}
  ) {}

  observe(subscriber: Subscriber<T>) {
    this._subscribers.add(subscriber)
    return () => this.unsubscribe(subscriber)
  }

  subscribe(subscriber: Subscriber<T>) {
    subscriber(this.peak())

    return this.observe(subscriber)
  }

  unsubscribe(subscriber: Subscriber<T>) {
    this._subscribers.delete(subscriber)
  }

  peak() {
    this._lastBroadcastValue = this._value
    return this._value
  }

  get() {
    const caller = Observable.context.at(-1)
    if (caller) this._dependents.add(caller)
    return this.peak()
  }

  protected addDependentsToBatch() {
    this._dependents.forEach((dependent) => {
      if (dependent._subscribers.size) {
        Observable.batchedUpdateChecks?.add(dependent)
      }
      dependent.addDependentsToBatch()
    })
  }

  protected requestUpdate() {
    if (Observable.batchedUpdateChecks) {
      Observable.batchedUpdateChecks.add(this)
    } else {
      this.updateSubscribers()
    }
  }

  protected updateSubscribers() {
    const { hasChanged = notEqual } = this._options
    if (hasChanged(this._lastBroadcastValue, this.peak())) {
      this._subscribers.forEach((subscriber) => subscriber(this._value))
      this._lastBroadcastValue = this._value
    }
  }

  protected _subscribers = new Set<Subscriber<T>>()
  protected _dependents = new Set<Computed<any>>()
  protected _lastBroadcastValue: T | undefined
}

/**
 * A computed observable that tracks dependencies and updates lazily
 * when they change if there are subscribers
 */
export class Computed<T> extends Observable<T> {
  constructor(
    protected getter: () => T,
    protected _options: ObservableOptions<T> = {}
  ) {
    super(undefined as T, _options)
  }

  observe = (subscriber: Subscriber<T>) => {
    // If the value is stale, there might be new untracked dependencies
    if (this._stale) {
      this.computeValue()
    }
    return super.observe(subscriber)
  }

  subscribe = (subscriber: Subscriber<T>) => {
    subscriber(this.peak())
    return this.observe(subscriber)
  }

  peak = () => {
    if (this._stale) {
      this.computeValue()
    }
    return super.peak()
  }

  get = () => {
    const caller = Observable.context.at(-1)
    if (caller) this._dependents.add(caller)
    return this.peak()
  }

  checkUpdates = () => {
    this._stale = true
    if (this._subscribers.size) {
      this.requestUpdate()
    }
    this._dependents.forEach((dependent) => dependent.checkUpdates())
  }

  protected computeValue() {
    Observable.context.push(this)
    this._value = this.getter()
    Observable.context.pop()

    this._stale = false
  }

  _stale = true
}

/**
 * A writable observable that allows setting a new value and can be
 * tracked by Computed observables
 */
export class Writable<T> extends Observable<T> {
  constructor(protected _initialValue: T, _options: ObservableOptions<T> = {}) {
    super(_initialValue, _options)
  }

  set = (value: T) => {
    const { hasChanged = notEqual } = this._options
    const prevValue = this._value

    if (hasChanged(prevValue, value)) {
      this._value = value
      this.requestUpdate()
      this._dependents.forEach((dependent) => dependent.checkUpdates())
    }
  }

  update = (updater: (currentValue: T) => T) => {
    this.set(updater(this._value))
  }

  reset = () => {
    this.set(this._initialValue)
  }
}

export const state = <T>(value: T, options?: ObservableOptions<T>) =>
  new Writable(value, options)

export const computed = <T>(getter: () => T, options?: ObservableOptions<T>) =>
  new Computed(getter, options)

export const batch = Observable.batch

export type Effect = () => void | (() => void)

export const watch = (callback: Effect, name: string = 'watcher') => {
  let count = 1
  let cleanup: (() => void) | void
  const watcher = computed(
    () => {
      cleanup?.()
      cleanup = callback()
      return count++
    },
    { name }
  )
  const unsubscribe = watcher.observe(() => {})
  return () => {
    unsubscribe()
    cleanup?.()
  }
}
