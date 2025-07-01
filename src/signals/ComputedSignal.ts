import { SignalBase, Subscriber, type SignalOptions } from './SignalBase'

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
}

/**
 * A computed signal that tracks dependencies and updates lazily
 * when they change if there are subscribers
 */
export class ComputedSignal<T> extends SignalBase<T> {
  constructor(protected getter: () => T, options: ComputedOptions<T> = {}) {
    const { cacheSize = 1, ..._options } = options
    super(undefined as T, _options)

    this._cacheSize = cacheSize
  }

  get peek() {
    const cachedResult = this._cache.find((cache) => {
      for (const [dependency, value] of cache.dependencies) {
        if (dependency.peek !== value) return false
      }
      return true
    })
    if (cachedResult) {
      // Move to the front of the cache
      this._cache.splice(this._cache.indexOf(cachedResult), 1)
      this._cache.unshift(cachedResult)

      // Swap out dependency subscriptions
      const cacheDependencies = new Set(cachedResult.dependencies.keys())
      const toRemove = this._dependencies.difference(cacheDependencies)
      toRemove.forEach(this.removeDependency)
      const toAdd = cacheDependencies.difference(this._dependencies)
      toAdd.forEach(this.addDependency)

      return (this._value = cachedResult.value)
    }

    return this.computeValue()
  }

  observe = (subscriber: Subscriber<T>) => {
    const unsubscribe = super.observe(subscriber)
    // Need to track dependencies now that we have a subscriber
    if (this._subscribers.size === 1) {
      this.peek
    }
    return unsubscribe
  }

  unsubscribe(subscriber: Subscriber<T>): void {
    super.unsubscribe(subscriber)
    // If there are no subscribers, unsubscribe from dependencies
    // since we don't need to track them anymore. When we get a new
    // subscriber, we'll recompute and re-subscribe to dependencies.
    if (!this._subscribers.size) {
      this.clearDependencies()
    }
  }

  setDependency = (dependency: SignalBase<any>) => {
    // Don't bother tracking dependencies if there are no subscribers
    if (this._subscribers.size) {
      this.addDependency(dependency)
    }
    const lastCache = this._cache[0]
    lastCache?.dependencies.set(dependency, dependency.peek)
  }

  protected computeValue() {
    SignalBase.context.push(this.setDependency)

    const previousDependencies = new Set(this._dependencies)
    this._dependencies = new Set()

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
    previousDependencies
      .difference(this._dependencies)
      .forEach(this.removeDependency)

    return this._value
  }

  protected addDependency = (dependency: SignalBase<any>) => {
    dependency.observe(this.updateSubscribers)
    this._dependencies.add(dependency)
  }

  protected removeDependency = (dependency: SignalBase<any>) => {
    dependency.unsubscribe(this.updateSubscribers)
    this._dependencies.delete(dependency)
  }

  protected clearDependencies = () => {
    this._dependencies.forEach(this.removeDependency)
  }

  protected _cacheSize = 1
  protected _cache = [] as CachedResult<T>[]
  protected _dependencies = new Set<SignalBase<any>>()
}

/**
 * Creates a computed signal that tracks signal dependencies, can be tracked by
 * other computed signals, and updates lazily
 * @param getter - The function that computes the value of the signal,
 *  tracking any dependencies with `.get()` or `.value` and ignoring any
 *  read with `.peek`
 * @param options
 * @returns
 * @example
 * ```ts
 * const count = signal(0)
 * const doubled = computed(() => count.get() * 2)
 * ```
 */
export const computed = <T>(getter: () => T, options?: ComputedOptions<T>) =>
  new ComputedSignal(getter, options)
