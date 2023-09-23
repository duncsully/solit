export type Subscriber<T> = (value: T) => void

export interface ObservableOptions<T> {
  hasChanged?(currentValue: T | undefined, newValue: T): boolean
}

export const notEqual = <T>(
  firstValue: T | undefined,
  secondValue: T | undefined
) => !Object.is(firstValue, secondValue)

export class Observable<T> {
  constructor(protected _value: T) {}

  get value() {
    return this._value
  }

  observe = (subscriber: Subscriber<T>) => {
    this._subscribers.add(subscriber)
    return () => this.unsubscribe(subscriber)
  }

  subscribe = (subscriber: Subscriber<T>) => {
    subscriber(this._value)
    return this.observe(subscriber)
  }

  unsubscribe = (subscriber: Subscriber<T>) => {
    this._subscribers.delete(subscriber)
  }

  protected _subscribers = new Set<Subscriber<T>>()
}

/**
 * An atomic state piece that allows subscribing to changes and tracks
 * dependent Computed and Reactive values
 */
export class ComputedObservable<T> {
  static context: ComputedObservable<any>[] = []
  static batchedUpdateChecks: undefined | Set<ComputedObservable<any>>
  /**
   * All subscription updates will be deferred until after passed action has run,
   * preventing a subscriber from being updated multiple times for multiple
   * writable observable write operations
   */
  static batch(action: () => void) {
    // If there is already a set, this is a nested call, don't flush until we
    // return to the top level
    const flush = !ComputedObservable.batchedUpdateChecks
    ComputedObservable.batchedUpdateChecks ??= new Set()
    action()
    if (flush) {
      ComputedObservable.batchedUpdateChecks?.forEach((observable) =>
        observable.updateSubscribers()
      )
      ComputedObservable.batchedUpdateChecks = undefined
    }
  }

  constructor(
    protected getter?: () => T,
    protected _options: ObservableOptions<T> = {}
  ) {
    // Need to compute the initial value to build the dependency graph
    this.computeValue()
  }

  get value() {
    return this.get()
  }

  /**
   * Gets the current value without updating dependents
   */
  peak = () => {
    if (this._stale) {
      this.computeValue()
    }
    return this._value
  }

  /**
   * Gets the current value and tracks dependencies
   */
  get = () => {
    const caller = ComputedObservable.context.at(-1)
    if (caller) this._dependents.add(caller)
    return this.peak()
  }

  /**
   * Observes for changes without immediately calling subscriber with current value
   * @param subscriber
   * @returns Unsubscribe function
   */
  observe = (subscriber: Subscriber<T>) => {
    this._subscribers.add(subscriber)
    // It's possible we have new dependencies that weren't tracked previously
    // due to no subscriptions prompting the value to be recomputed
    // This subscriber needs to be updated if those new dependencies get updated
    if (this._stale) {
      this.computeValue()
    }
    return () => this.unsubscribe(subscriber)
  }

  /**
   * Observes for changes and immediately calls subscriber with current value
   * @param subscriber
   * @returns Unsubscribe function
   */
  subscribe = (subscriber: Subscriber<T>) => {
    subscriber(this._value)
    return this.observe(subscriber)
  }

  unsubscribe = (updateHandler: Subscriber<T>) => {
    this._subscribers.delete(updateHandler)
  }

  protected _value!: T

  protected _stale = true

  protected _dependents = new Set<ComputedObservable<any>>()

  protected _subscribers = new Set<Subscriber<T>>()

  /**
   * Recurse the dependency graph to get all updates that need to be run
   * @param isTop Whether this is the top level call, if so, we don't need to
   * check if the value has changed
   * @returns
   */
  protected getAllUpdates = (isTop?: boolean) => {
    const { hasChanged = notEqual } = this._options
    const allSubscribers: (() => void)[] = []

    if (this._subscribers.size) {
      const oldValue = this._value
      this.computeValue()
      // Writable observable will already have had its previous and new value checked
      if (isTop || hasChanged(oldValue, this._value)) {
        this._subscribers.forEach((subscriber) =>
          allSubscribers.push(() => subscriber(this._value))
        )
      }
    } else {
      this._stale = true
    }

    this._dependents.forEach((dependent) => {
      allSubscribers.push(...dependent.getAllUpdates())
    })

    return allSubscribers
  }

  protected updateSubscribers() {
    const updates = this.getAllUpdates(true)
    updates.forEach((update) => update())
  }

  protected setDependentsStale() {
    this._dependents.forEach((dependent) => {
      dependent._stale = true
      dependent.setDependentsStale()
    })
  }

  protected computeValue() {
    if (this.getter) {
      ComputedObservable.context.push(this)
      this._value = this.getter()
      this._stale = false
      ComputedObservable.context.pop()
    }
  }
}

export class WritableObservable<T> extends ComputedObservable<T> {
  constructor(protected initialValue: T, options?: ObservableOptions<T>) {
    super(undefined, options)
    this._value = initialValue
  }

  set = (value: T) => {
    const currentValue = this._value
    this._value = value
    const { hasChanged = notEqual } = this._options

    if (!hasChanged(currentValue, value)) return

    if (!ComputedObservable.batchedUpdateChecks) {
      this.updateSubscribers()
    } else {
      ComputedObservable.batchedUpdateChecks.add(this)
      // Mark all dependents as stale so they will be recomputed as needed
      this.setDependentsStale()
    }
  }

  update = (updater: (currentValue: T) => T) => {
    this.set(updater(this._value))
  }

  reset = () => {
    this.set(this.initialValue)
  }

  get value() {
    return super.value
  }
  set value(newValue: T) {
    this.set(newValue)
  }
}

export const state = <T>(value: T, options?: ObservableOptions<T>) =>
  new WritableObservable(value, options)
export const computed = <T>(getter: () => T, options?: ObservableOptions<T>) =>
  new ComputedObservable(getter, options)

export const batch = ComputedObservable.batch
