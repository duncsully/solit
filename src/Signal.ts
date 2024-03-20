export type Subscriber<T> = (value: T) => void

export type SignalOptions<T> = {
  /**
   * Function that determines if the new value is different from the current value.
   * By default, uses Object.is
   */
  hasChanged?(currentValue: T | undefined, newValue: T): boolean
  /**
   * Optional name for debugging purposes
   */
  name?: string
}

export const notEqual = <T>(
  firstValue: T | undefined,
  secondValue: T | undefined
) => !Object.is(firstValue, secondValue)

/**
 * How it works
 *
 * - Computed signals track what signals they depend on via .get()
 *
 * - WritableSignals are what get directly interacted with. Computed signals can only
 *   change when a writable changes.
 *
 * - A computed signal only needs to be computed if its value is actually read,
 *   either directly or if there are subscribers and a dependency changes, informing
 *   it that it might need to recompute.
 *
 * - A computed can also track what its dependencies' values are per computation, so if
 *   it gets read again with the same dependency values, it can use the cached value.
 *   By default the cache size is 1, so it only caches the last computation.
 *
 * - Writable sets can be batched, so that if multiple writables are changed, subscribers
 *   are only updated once after all the writes have happened, and only for what
 *   signals have actually changed. This means that a computed value may need to
 *   be recomputed, but its value may not have changed, so it won't need to update subscribers
 */

/**
 * Core signal class that allows subscribing to changes,
 * reading values, and responding to changes
 */
export class SignalBase<T> {
  static context: Computed<any>[] = []

  constructor(protected _value: T, protected _options: SignalOptions<T> = {}) {
    this._lastBroadcastValue = _value
  }

  get value() {
    return this.get()
  }

  /**
   * Subscribes callback to changes. Does not immediately call it with the current
   * value.
   * @returns A function that unsubscribes the callback
   */
  observe(subscriber: Subscriber<T>) {
    this._subscribers.add(subscriber)
    return () => this.unsubscribe(subscriber)
  }

  /**
   * Subscribes callback to changes and immediately calls it with the current value.
   * @returns A function that unsubscribes the callback
   */
  subscribe(subscriber: Subscriber<T>) {
    const unsubscribe = this.observe(subscriber)

    subscriber(this.peek())

    return unsubscribe
  }

  /**
   * Unsubscribes a callback from changes
   */
  unsubscribe(subscriber: Subscriber<T>) {
    this._subscribers.delete(subscriber)
  }

  /**
   * Get the current value without setting this signal as a dependency
   * of the calling computed signal
   */
  peek() {
    this._lastBroadcastValue = this._value
    return this._value
  }

  /**
   * Get the current value and set this signal as a dependency of the
   * calling computed signal
   */
  get() {
    const caller = SignalBase.context.at(-1)
    const value = this.peek()
    if (caller) {
      this._dependents.add(caller._selfRef)
      caller.setCacheDependency(this, value)
    }
    return value
  }

  protected updateSubscribers() {
    const { hasChanged = notEqual } = this._options
    if (
      this._subscribers.size &&
      hasChanged(this._lastBroadcastValue, this.peek())
    ) {
      this._subscribers.forEach((subscriber) => subscriber(this._value))
    }

    // Since these may be removed from the set, we need to make a copy
    // before iterating
    const dependents = [...this._dependents]

    for (const dependentRef of dependents) {
      const dependent = dependentRef.deref()
      if (dependent) {
        dependent.updateSubscribers()
      } else {
        this._dependents.delete(dependentRef)
      }
    }
  }

  addDependent(dependentRef: WeakRef<Computed<any>>) {
    this._dependents.add(dependentRef)
  }

  removeDependent(dependentRef: WeakRef<Computed<any>>) {
    this._dependents.delete(dependentRef)
  }

  protected _subscribers = new Set<Subscriber<T>>()
  protected _dependents = new Set<WeakRef<Computed<any>>>()
  protected _lastBroadcastValue: T | undefined
  protected _selfRef = new WeakRef(this)
}

type CachedResult<T> = {
  value: T
  dependencies: Map<SignalBase<any>, any>
}

export type ComputedOptions<T> = SignalOptions<T> & {
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
 * A computed signal that tracks dependencies and updates lazily
 * when they change if there are subscribers
 */
export class Computed<T> extends SignalBase<T> {
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

  peek = () => {
    if (this._idleCallbackHandle) {
      cancelIdleCallback(this._idleCallbackHandle)
      this._idleCallbackHandle = undefined
    }
    const cachedResult = this._cache.find((cache) => {
      for (const [dependency, value] of cache.dependencies) {
        if (dependency.peek() !== value) return false
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
    return super.peek()
  }

  setCacheDependency = (dependency: SignalBase<any>, value: any) => {
    this._lastDependencies.add(dependency)
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

  [Symbol.iterator]() {
    return [this.get].values()
  }

  protected computeValue() {
    SignalBase.context.push(this)
    this._lastDependencies.forEach((dependency) => {
      dependency.removeDependent(this._selfRef)
    })
    this._lastDependencies.clear()
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
    SignalBase.context.pop()
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
  protected _lastDependencies = new Set<SignalBase<any>>()
}

/**
 * A writable signal that allows setting a new value and can be
 * tracked by Computed signals
 */
export class Signal<T> extends SignalBase<T> {
  static batchedUpdateChecks: null | Set<Signal<any>>
  /**
   * All subscription updates will be deferred until after passed action has run,
   * preventing a subscriber from being updated multiple times for multiple
   * writable signal write operations
   */
  static batch(action: () => void) {
    // If there is already a set, this is a nested call, don't flush until we
    // return to the top level
    const flush = !Signal.batchedUpdateChecks
    Signal.batchedUpdateChecks ??= new Set()
    action()
    if (flush) {
      Signal.batchedUpdateChecks?.forEach((signal) => {
        signal.updateSubscribers()
      })
      Signal.batchedUpdateChecks = null
    }
  }
  constructor(protected _initialValue: T, _options: SignalOptions<T> = {}) {
    super(_initialValue, _options)
  }

  get value() {
    return super.value
  }
  set value(value: T) {
    this.set(value)
  }

  /**
   * Set a value and update subscribers if it has changed
   */
  set = (value: T) => {
    const { hasChanged = notEqual } = this._options
    const prevValue = this._value

    if (hasChanged(prevValue, value)) {
      this._value = value
      this.requestUpdate()
    }
  }

  /**
   * Update the value with a function that takes the current value and returns
   * a new value, and update subscribers if it has changed
   */
  update = (updater: (currentValue: T) => T) => {
    this.set(updater(this._value))
  }

  /**
   * Mutate the value with a function that takes the current value and mutates
   * it, and update subscribers if it has changed. Note: you will need to implement
   * your own `hasChanged` option for this to work with objects and arrays.
   */
  mutate = (mutator: (currentValue: T) => void) => {
    mutator(this._value)
    this.requestUpdate()
  }

  /**
   * Reset the value to the initial value
   */
  reset = () => {
    this.set(this._initialValue)
  };

  [Symbol.iterator]() {
    return [this.get, this.set].values()
  }

  protected requestUpdate() {
    if (Signal.batchedUpdateChecks) {
      Signal.batchedUpdateChecks.add(this)
    } else {
      this.updateSubscribers()
    }
  }
}

/**
 * Creates a writable signal that allows setting a new value and can be
 * tracked by computed signals
 * @param value - The initial value of the signal
 * @param options
 * @returns
 * @example
 * ```ts
 * const count = signal(0)
 * count.set(1) // 1
 * count.update(value => value + 1) // 2
 * count.reset() // 0
 * ```
 */
export const signal = <T>(value: T, options?: SignalOptions<T>) =>
  new Signal(value, options) as Signal<T>

/**
 * Creates a computed signal that tracks signal dependencies, can be tracked by
 * other computed signals, and updates lazily
 * @param getter - The function that computes the value of the signal,
 *  tracking any dependencies with `.get()` and ignoring any
 *  read with `.peek()`
 * @param options
 * @returns
 * @example
 * ```ts
 * const count = signal(0)
 * const doubled = computed(() => count.get() * 2)
 * ```
 */
export const computed = <T>(getter: () => T, options?: ComputedOptions<T>) =>
  new Computed(getter, options)

/**
 * Defer checking for subscription updates until passed action has run,
 * preventing a subscriber from being updated multiple times for multiple
 * signal write operations, and only if the final value has
 * changed
 * @example
 * ```ts
 * const height = signal(2)
 * const width = signal(6)
 * const area = computed(() => height.get() * width.get())
 *
 * batch(() => {
 *  height.set(3)
 *  width.set(4)
 * // Area will be updated only once, and it won't call subscribers
 * // since its value hasn't changed
 * })
 * ```
 */
export const batch = Signal.batch

export type Effect = () => void | (() => void)

/**
 * Call the passed callback immediately and whenever any of its signal
 * dependencies change. Optionally return a cleanup function and it will be
 * called before the next time the callback is called or when the watcher is
 * unsubscribed.
 * @param callback
 * @param [name=watcher] - Optional name for debugging purposes
 * @returns A function that unsubscribes the watcher
 */
export const watch = (callback: Effect, name: string = 'watcher') => {
  let cleanup: (() => void) | void
  const watcher = computed(
    () => {
      batch(() => {
        cleanup?.()
        cleanup = callback()
      })
    },
    { name, hasChanged: () => true }
  )
  const unsubscribe = watcher.subscribe(() => {})
  return () => {
    unsubscribe()
    cleanup?.()
  }
}
