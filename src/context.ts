/**
 * Creates a context object that can be used to pass values deeply through a callstack,
 * such as a Solit-html component tree.
 * @param defaultValue - The default value for the context. This is used when no provider
 * is found in the callstack.
 * @returns
 */
export const createContext = <T>(defaultValue: T) => new Context(defaultValue)

export class Context<T> {
  constructor(defaultValue: T) {
    this.#stack.push(defaultValue)
  }

  #stack: T[] = []

  /**
   * The current value of the context. This is the last value pushed onto the stack.
   * If no value has been pushed, this will be the default value.
   */
  get value() {
    return this.#stack.at(-1) as T
  }

  /**
   * Provides a value to the context for the duration of the callback. The value is
   * pushed onto the stack, and popped off when the callback returns. This allows for
   * deeply nested contexts to be created, and for the value to be restored when the
   * callback returns.
   */
  provide<K>(value: T, fn: () => K) {
    this.#stack.push(value)
    const result = fn()
    this.#stack.pop()
    return result
  }

  /**
   * Like `provide`, but for async functions. The value is pushed onto the stack,
   * and popped off when the callback resolves.
   * @param value
   * @param fn
   * @returns
   */
  async provideAsync<K>(value: T, fn: () => Promise<K>) {
    this.#stack.push(value)
    const result = await fn()
    this.#stack.pop()
    return result
  }
}
