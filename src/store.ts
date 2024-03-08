import {
  Computed,
  Observable,
  Writable,
  batch,
  computed,
  state,
} from './Observable'

type IfEquals<X, Y, A, B> = (<T>() => T extends X ? 1 : 2) extends <
  T
>() => T extends Y ? 1 : 2
  ? A
  : B

type WritableKeysOf<T> = {
  [P in keyof T]: IfEquals<
    { [Q in P]: T[P] },
    { -readonly [Q in P]: T[P] },
    P,
    never
  >
}[keyof T]

type Store<T> = {
  [K in keyof T]: T[K] extends Function
    ? T[K]
    : T[K] extends Object
    ? Store<T[K]>
    : T[K]
} & {
  $?: {
    [K in keyof T]: K extends WritableKeysOf<T>
      ? T[K] extends Object
        ? Writable<Store<T[K]>>
        : Writable<T[K]>
      : Computed<T[K]>
  }
}

/* 
TODO:
- Figure out how to remove the ? from the $ property without assignment type errors
- Handle setters?
- Provide peek function for inside store declarations? e.g.
  const store = store({
    width: 1,
    height: 2,
    get area() {
      return peek(this.width) * this.height
    },
  })
- Test for memory leaks and junk
- Better array support
*/

/**
 * Accepts an object and returns a new object with all of the values wrapped in
 * signals. If a value is an object, then it will be recursively wrapped. Properties
 * that are getters will be wrapped in a computed signal, while all other properties
 * will be wrapped in a writable signal. Reading a property will call the signal's
 * get method, while writing to a property will call the signal's set method.
 * @param initialState
 * @returns
 * @example
 *
 * ```ts
 * const store = store({
 *   width: 1,
 *   height: 2,
 *   get area() {
 *     return this.width * this.height
 *   },
 *
 * store.area // 2
 * store.width = 3
 * store.area // 6
 * ```
 */
export const store = <T extends object>(initialState: T) => {
  const signalMap: { [keyPath: string]: Observable<any> } = {}
  const recursivelyUpdateSignals = (obj: any, keyPathPrefix = '') => {
    Object.keys(obj).forEach((key) => {
      const keyPath = `${keyPathPrefix}.${key}`
      const signal = signalMap[keyPath]
      if (signal instanceof Writable) {
        signal.set(obj[key])
      } else {
        signalMap[keyPath] = state(obj[key])
      }
      if (obj[key] instanceof Object) {
        recursivelyUpdateSignals(obj[key], keyPath)
      }
    })
  }

  const createProxy = (obj: any, keyPathPrefix = '') => {
    const getSignal = (target: any, key: string | symbol) => {
      const keyPath = `${keyPathPrefix}.${key.toString()}`
      if (signalMap[keyPath]) {
        return signalMap[keyPath]
      }
      const descriptor = Object.getOwnPropertyDescriptor(target, key)
      if (descriptor?.get) {
        const signal = (signalMap[keyPath] = computed(
          descriptor.get.bind(result)
        ))
        return signal
      } else {
        let value = target[key]
        if (value instanceof Object) {
          value = createProxy(value, keyPath)
        }
        const signal = (signalMap[keyPath] = state(value))
        return signal
      }
    }
    const result: any = new Proxy(obj, {
      get(target, key) {
        // Provides a way to access all signals on the object
        // e.g. store.someSignal = store.$?.someSignal.get()
        if (key === '$') {
          return new Proxy(target, {
            get(target, key) {
              return getSignal(target, key)
            },
          })
        }
        return getSignal(target, key).get()
      },
      set(_, key, value) {
        const keyPath = `${keyPathPrefix}.${key.toString()}`
        const signal = signalMap[keyPath]
        let newValue = value
        batch(() => {
          if (value instanceof Object) {
            newValue = createProxy(value, keyPath)
            recursivelyUpdateSignals(value, keyPath)
          }
          if (signal instanceof Writable) {
            signal.set(newValue)
          } else {
            signalMap[keyPath] = state(newValue)
          }
        })
        return true
      },
      apply(target, thisArg, argArray) {
        let result
        batch(() => {
          result = target.apply(thisArg, argArray)
        })
        return result
      },
    })
    return result
  }
  return createProxy(initialState) as Store<T>
}