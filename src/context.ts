export const createContext = <T>(initialValue: T) => new Context(initialValue)

export class Context<T> {
  constructor(initialValue: T) {
    this.stack.push(initialValue)
  }

  stack: T[] = []

  get value() {
    return this.stack.at(-1) as T
  }

  provide<K>(value: T, fn: () => K) {
    this.stack.push(value)
    const result = fn()
    this.stack.pop()
    return result
  }

  async provideAsync<K>(value: T, fn: () => Promise<K>) {
    this.stack.push(value)
    const result = await fn()
    this.stack.pop()
    return result
  }
}
