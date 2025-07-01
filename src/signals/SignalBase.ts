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

/**
 * Core signal class that allows subscribing to changes,
 * reading values, and responding to changes
 */
export class SignalBase<T> {
  static context: ((signal: SignalBase<any>) => void)[] = []
  static _getToSignalMap = new WeakMap<
    SignalBase<any>['get'],
    SignalBase<any>
  >()

  constructor(
    protected _initialValue: T,
    protected _options: SignalOptions<T> = {}
  ) {
    this.get = this.get.bind(this)
    this.updateSubscribers = this.updateSubscribers.bind(this)

    SignalBase._getToSignalMap.set(this.get, this)
  }

  /**
   * Get the current value without setting this signal as a dependency
   * of the calling computed signal
   */
  get peek() {
    return this._value
  }

  /**
   * Reading gets the current value, setting this signal as a dependency if the caller
   * is a computed signal. Assigning a new value will update subscribers if it has changed.
   */
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

    subscriber(this.peek)

    this._lastBroadcastValue = this._value

    return unsubscribe
  }

  /**
   * Unsubscribes a callback from changes
   */
  unsubscribe(subscriber: Subscriber<T>) {
    this._subscribers.delete(subscriber)
  }

  /**
   * Get the current value, setting this signal as a dependency if the caller
   * is a computed signal
   */
  get() {
    const caller = SignalBase.context.at(-1)
    caller?.(this)

    return this.peek
  }

  /**
   * Returns the current value of the signal (for JSON serialization)
   * @returns The current value of the signal
   */
  toJSON() {
    return this.peek
  }

  /**
   * Check if the signal has subscribers that need to be updated,
   * and if so, calls them with the current value.
   */
  protected updateSubscribers() {
    const { hasChanged = notEqual } = this._options
    if (
      this._subscribers.size &&
      hasChanged(this._lastBroadcastValue, this.peek)
    ) {
      this._subscribers.forEach((subscriber) => subscriber(this._value))
      this._lastBroadcastValue = this._value
    }
  }
  /**
   * The current value of the signal.
   */
  protected _value = this._initialValue
  /**
   * Tracks what the last value was that was broadcasted to subscribers
   * in case the value changes but changes back to the last broadcasted value
   * before the next update. This prevents unnecessary updates to subscribers.
   */
  protected _lastBroadcastValue = this._initialValue
  /**
   * Set of callbacks to be called when the value changes.
   */
  protected _subscribers = new Set<Subscriber<T>>()
}

export const notEqual = <T>(
  firstValue: T | undefined,
  secondValue: T | undefined
) => !Object.is(firstValue, secondValue)
