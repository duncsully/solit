export type Subscriber<T> = (value: T) => void

export type ObservableOptions<T> = {
  hasChanged?(currentValue: T | undefined, newValue: T): boolean
  name?: string
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
      // Only need to track this dependency if somewhere up the stack one
      // of the observables has subscribers

      this._dependents.add(caller._selfRef)
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

    this._dependents.forEach((dependentRef) => {
      const dependent = dependentRef.deref()
      if (dependent) {
        dependent.updateSubscribers()
      } else {
        this._dependents.delete(dependentRef)
      }
    })
  }

  addDependent(dependentRef: WeakRef<Computed<any>>) {
    this._dependents.add(dependentRef)
  }

  protected _subscribers = new Set<Subscriber<T>>()
  protected _dependents = new Set<WeakRef<Computed<any>>>()
  protected _lastBroadcastValue: T | undefined
  protected _selfRef = new WeakRef(this)
}

type CachedResult<T> = {
  value: T
  dependencies: Map<Observable<any>, any>
}

export type ComputedOptions<T> = ObservableOptions<T> & {
  /**
   * Cache this number of previous computations. When given the same dependency
   * values as in the cache, cache value is used
   */
  cacheSize?: number
  /**
   * If true, will compute value on idle callback when dependencies change while
   * there are no subscribers
   */
  computeOnIdle?: boolean
}

/**
 * A computed observable that tracks dependencies and updates lazily
 * when they change if there are subscribers
 */
export class Computed<T> extends Observable<T> {
  constructor(protected getter: () => T, options: ComputedOptions<T> = {}) {
    const { cacheSize = 1, computeOnIdle = false, ..._options } = options
    super(undefined as T, _options)
    this._cacheSize = cacheSize
    this._computeOnIdle = computeOnIdle && !!globalThis.requestIdleCallback
    if (this._computeOnIdle) {
      this.requestIdleComputed()
    }
  }

  observe = (subscriber: Subscriber<T>) => {
    const unsubscribe = super.observe(subscriber)
    // Need to track dependencies now that we have a subscriber
    if (this._subscribers.size === 1) {
      this.computeValue()
    }
    return unsubscribe
  }

  peak = () => {
    if (this._idleCallbackHandle) {
      cancelIdleCallback(this._idleCallbackHandle)
      this._idleCallbackHandle = undefined
    }
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

  updateSubscribers() {
    super.updateSubscribers()
    if (!this._subscribers.size && this._computeOnIdle) {
      this.requestIdleComputed()
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

  protected requestIdleComputed() {
    if (this._idleCallbackHandle) {
      cancelIdleCallback(this._idleCallbackHandle)
    }
    this._idleCallbackHandle = requestIdleCallback(() => {
      this._idleCallbackHandle = undefined
      this.computeValue()
    })
  }

  protected _cacheSize = 1
  protected _cache = [] as CachedResult<T>[]
  protected _computeOnIdle = false
  protected _idleCallbackHandle: number | undefined
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

  mutate = (mutator: (currentValue: T) => void) => {
    mutator(this._value)
    this.requestUpdate()
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

/**
 * Creates a writable observable that allows setting a new value and can be
 *  tracked by omputed observables
 * @param value - The initial value of the observable
 * @param options
 * @returns
 * @example
 * ```ts
 * const count = state(0)
 * count.set(1) // 1
 * count.update(value => value + 1) // 2
 * count.rest() // 0
 * ```
 */
export const state = <T>(value: T, options?: ObservableOptions<T>) =>
  new Writable(value, options)

/**
 * Creates a computed observable that tracks dependencies, can be tracked by
 * other computed observables, and updates lazily
 * @param getter - The function that computes the value of the observable,
 *  tracking any dependencies with `Observable.get()` and ignoring any
 *  read with `Observable.peak()`
 * @param options
 * @returns
 * @example
 * ```ts
 * const count = state(0)
 * const doubled = computed(() => count.get() * 2)
 * ```
 */
export const computed = <T>(getter: () => T, options?: ComputedOptions<T>) =>
  new Computed(getter, options)

/**
 * Defer checking for subscription updates until passed action has run,
 * preventing a subscriber from being updated multiple times for multiple
 * writable observable write operations, and only if the final value has
 * changed
 */
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
  const unsubscribe = watcher.subscribe(() => {})
  return () => {
    unsubscribe()
    cleanup?.()
  }
}
