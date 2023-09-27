export type Subscriber<T> = (value: T) => void

export type ObservableOptions<T> = {
  hasChanged?(currentValue: T | undefined, newValue: T): boolean
  name?: string
}

export type ComputedOptions<T> = ObservableOptions<T> & {
  /**
   * Cache this number of previous computations. When given the same dependency
   * values as in the cache, cache value is used
   */
  cache?: number
}

type CachedResult<T> = {
  value: T
  dependencies: Map<Observable<any>, any>
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
    const value = this.peak()
    if (caller) {
      this._dependents.add(caller)
      caller.setCacheDependency(this)
    }
    return value
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

  protected checkDependents() {
    this._dependents.forEach((dependent) => {
      dependent.checkUpdates()
      // If the dependent has no subscribers, it can be garbage collected
      // It'll be readded if .gets() this observable again
      if (!dependent._subscribers.size) {
        this._dependents.delete(dependent)
      }
    })
  }

  addDependent(dependent: Computed<any>) {
    this._dependents.add(dependent)
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
    protected _options: ComputedOptions<T> = {}
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
      const cachedResult = this._cache.find((cache) => {
        for (const [dependency, value] of cache.dependencies) {
          if (dependency.peak() !== value) return false
        }
        return true
      })
      if (cachedResult) {
        this._value = cachedResult.value
        // Need to tell dependencies that they need to update us again if they change
        cachedResult.dependencies.forEach((_, dependency) => {
          dependency.addDependent(this)
        })
        this._stale = false
      } else {
        this.computeValue()
      }
    }
    return super.peak()
  }

  get = () => {
    const caller = Observable.context.at(-1)
    const value = this.peak()
    if (caller) {
      this._dependents.add(caller)
      caller.setCacheDependency(this)
    }
    return value
  }

  checkUpdates = () => {
    this._stale = true
    if (this._subscribers.size) {
      this.requestUpdate()
    }
    this.checkDependents()
  }

  setCacheDependency = (dependency: Observable<any>) => {
    const lastCache = this._cache.at(-1)
    if (lastCache) {
      lastCache.dependencies.set(dependency, dependency.peak())
    }
  }

  protected computeValue() {
    Observable.context.push(this)
    if (this._options.cache) {
      if (this._cache.length >= this._options.cache) {
        this._cache.shift()
      }
      this._cache.push({
        value: this._value,
        dependencies: new Map(),
      })
    }
    this._value = this.getter()
    const lastCache = this._cache.at(-1)
    if (lastCache) lastCache.value = this._value
    Observable.context.pop()

    this._stale = false
  }

  protected _stale = true
  protected _cache = [] as CachedResult<T>[]
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
      this.checkDependents()
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
