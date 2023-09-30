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
  cacheSize?: number
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
 * How it works
 *
 * - Computed observables track what observables they depend on via Observable.get()
 *
 * - Writables are what get directly interacted with. Computed observables can only
 *   change when a writable changes.
 *
 * - A computed observable only needs to be computed if its value is actually read,
 *   either directly or if there are subscribers and a dependency changes, informing
 *   it that it might need to recompute.
 *
 * - But if a computed observable has no subscribers, it doesn't need to be recomputed
 *   when its dependencies change, so its dependencies can stop tracking it until it
 *   gets manually read or subscribed to again, and it can be garbage collected otherwise.
 *
 * - A computed can also track what its dependencies' values are per computation, so if
 *   it gets read again with the same dependency values, it can use the cached value.
 *   By default the cache size is 1, so it only caches the last computation.
 *
 * - Writable sets can be batched, so that if multiple writables are changed, subscribers
 *   are only updated once after all the writes have happened, and only for what
 *   Observables have actually changed. This means that a computed value may need to
 *   be recomputed, but its value may not have changed, so it won't need to update subscribers
 */

/**
 * Core observable class that allows subscribing to changes,
 * reading values, and responding to changes
 */
export class Observable<T> {
  static context: Computed<any>[] = []

  constructor(
    protected _value: T,
    protected _options: ObservableOptions<T> = {}
  ) {
    this._lastBroadcastValue = _value
  }

  observe(subscriber: Subscriber<T>) {
    this._subscribers.add(subscriber)
    return () => this.unsubscribe(subscriber)
  }

  subscribe(subscriber: Subscriber<T>) {
    const unsubscribe = this.observe(subscriber)

    subscriber(this.peak())

    return unsubscribe
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
      caller.setCacheDependency(this, value)
    }
    return value
  }

  protected updateSubscribers() {
    const { hasChanged = notEqual } = this._options
    if (
      this._subscribers.size &&
      hasChanged(this._lastBroadcastValue, this.peak())
    ) {
      this._subscribers.forEach((subscriber) => subscriber(this._value))
    }
    this.checkDependents()
  }

  protected checkDependents() {
    this._dependents.forEach((dependent) => {
      dependent.updateSubscribers()
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
  constructor(protected getter: () => T, options: ComputedOptions<T> = {}) {
    const { cacheSize = 1, ..._options } = options
    super(undefined as T, _options)
    this._cacheSize = cacheSize
  }

  observe = (subscriber: Subscriber<T>) => {
    // Need to track dependencies now that we have a subscriber
    if (!this._subscribers.size) {
      this.computeValue()
    }
    return super.observe(subscriber)
  }

  peak = () => {
    const cachedResult = this._cache.find((cache) => {
      for (const [dependency, value] of cache.dependencies) {
        if (dependency.peak() !== value) return false
      }
      return true
    })
    if (cachedResult) {
      // Move to the front of the cache
      this._cache.splice(this._cache.indexOf(cachedResult), 1)
      this._cache.unshift(cachedResult)

      this._value = cachedResult.value
    } else {
      this.computeValue()
    }
    return super.peak()
  }

  setCacheDependency = (dependency: Observable<any>, value: any) => {
    const lastCache = this._cache[0]
    if (lastCache) {
      lastCache.dependencies.set(dependency, value)
    }
  }

  protected computeValue() {
    Observable.context.push(this)
    if (this._cacheSize) {
      this._cache.unshift({
        value: this._value,
        dependencies: new Map(),
      })
      this._cache.splice(this._cacheSize, Infinity)
    }
    this._value = this.getter()
    const lastCache = this._cache[0]
    if (lastCache) lastCache.value = this._value
    Observable.context.pop()
  }

  protected _cacheSize = 1
  protected _cache = [] as CachedResult<T>[]
}

/**
 * A writable observable that allows setting a new value and can be
 * tracked by Computed observables
 */
export class Writable<T> extends Observable<T> {
  static batchedUpdateChecks: null | Set<Writable<any>>
  /**
   * All subscription updates will be deferred until after passed action has run,
   * preventing a subscriber from being updated multiple times for multiple
   * writable observable write operations
   */
  static batch(action: () => void) {
    // If there is already a set, this is a nested call, don't flush until we
    // return to the top level
    const flush = !Writable.batchedUpdateChecks
    Writable.batchedUpdateChecks ??= new Set()
    action()
    if (flush) {
      Writable.batchedUpdateChecks?.forEach((observable) => {
        observable.updateSubscribers()
      })
      Writable.batchedUpdateChecks = null
    }
  }
  constructor(protected _initialValue: T, _options: ObservableOptions<T> = {}) {
    super(_initialValue, _options)
  }

  set = (value: T) => {
    const { hasChanged = notEqual } = this._options
    const prevValue = this._value

    if (hasChanged(prevValue, value)) {
      this._value = value
      this.requestUpdate()
    }
  }

  update = (updater: (currentValue: T) => T) => {
    this.set(updater(this._value))
  }

  reset = () => {
    this.set(this._initialValue)
  }

  protected requestUpdate() {
    if (Writable.batchedUpdateChecks) {
      Writable.batchedUpdateChecks.add(this)
    } else {
      this.updateSubscribers()
    }
  }
}

export const state = <T>(value: T, options?: ObservableOptions<T>) =>
  new Writable(value, options)

export const computed = <T>(getter: () => T, options?: ObservableOptions<T>) =>
  new Computed(getter, options)

export const batch = Writable.batch

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
