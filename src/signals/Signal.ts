import { SignalBase, type SignalOptions } from './SignalBase'

/**
 * A writable signal that allows setting a new value and can be
 * tracked by Computed signals
 */
export class Signal<T> extends SignalBase<T> {
  static batchedUpdateChecks: null | Set<() => void>
  /**
   * All subscription updates will be deferred until after passed action has run,
   * preventing a subscriber from being updated multiple times for multiple
   * writable signal write operations
   */
  static batch<K>(action: () => K) {
    // If there is already a set, this is a nested call, don't flush until we
    // return to the top level
    const flush = !Signal.batchedUpdateChecks
    Signal.batchedUpdateChecks ??= new Set()
    const result = action()
    if (flush) {
      Signal.batchedUpdateChecks?.forEach(Reflect.apply)
      Signal.batchedUpdateChecks = null
    }
    return result
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
    this._value = value
    this.requestUpdate()
  }

  /**
   * Update the value with a function that takes the current value and returns
   * a new value, and update subscribers if it has changed
   */
  update = (updater: (currentValue: T) => T) => {
    this.set(updater(this._value))
  }

  /**
   * Reset the value to the initial value
   */
  reset = () => {
    this.set(this._initialValue)
  }

  protected requestUpdate() {
    if (Signal.batchedUpdateChecks) {
      Signal.batchedUpdateChecks.add(this.updateSubscribers)
      return
    }
    this.updateSubscribers()
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
  new Signal(value, options)

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
