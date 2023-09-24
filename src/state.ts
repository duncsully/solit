export type Subscriber<T> = (value: T) => void

export interface ObservableOptions<T> {
  hasChanged?(currentValue: T | undefined, newValue: T): boolean
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
  static batchedUpdateChecks: undefined | Set<Observable<any>>
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
        const { hasChanged = notEqual } = observable._options
        if (hasChanged(observable._lastBroadcastValue, observable._value)) {
          observable.updateSubscribers()
        }
      })
      Observable.batchedUpdateChecks = undefined
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
    if (this._value !== undefined) subscriber(this._value)

    return this.observe(subscriber)
  }

  unsubscribe(subscriber: Subscriber<T>) {
    this._subscribers.delete(subscriber)
  }

  peak() {
    return this._value
  }

  get() {
    const caller = Observable.context.at(-1)
    if (caller) this._dependents.add(caller)
    return this.peak()
  }

  protected set(value: T) {
    const { hasChanged = notEqual } = this._options
    const prevValue = this._value

    if (hasChanged(prevValue, value)) {
      this._value = value
      this._dependents.forEach((dependent) => dependent.checkUpdates())
      if (Observable.batchedUpdateChecks) {
        Observable.batchedUpdateChecks.add(this)
      } else {
        this.updateSubscribers()
      }
    }
  }

  protected updateSubscribers() {
    this._subscribers.forEach((subscriber) => subscriber(this._value))
    this._lastBroadcastValue = this._value
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
    // We need to initialize first to build the dependency graph,
    // and then we'll have the initial value to set
    super(undefined as T, _options)
    this.computeValue()
  }

  observe = (subscriber: Subscriber<T>) => {
    if (this._stale) {
      this.computeValue()
    }
    return super.observe(subscriber)
  }

  subscribe = (subscriber: Subscriber<T>) => {
    if (this._stale) {
      this.computeValue()
    }
    subscriber(this._value)
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
    // If there are no subscribers or if we're in a batch, defer
    // updating value
    if (this._subscribers.size && !Observable.batchedUpdateChecks) {
      this.computeValue()
      return
    }
    // Set self and dependents to stale so they'll recompute as needed
    this._stale = true
    this._dependents.forEach((dependent) => (dependent._stale = true))
  }

  protected computeValue() {
    Observable.context.push(this)
    this.set(this.getter())
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
    super.set(value)
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

export const watch = (callback: Effect) => {
  let cleanup: (() => void) | void
  const watcher = computed(() => {
    cleanup?.()
    cleanup = callback()
  })
  const unsubscribe = watcher.observe(() => {})
  return () => {
    unsubscribe()
    cleanup?.()
  }
}
