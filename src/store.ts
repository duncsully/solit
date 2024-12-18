import { Computed, SignalBase, Signal, batch, computed, signal } from './Signal'

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
  readonly $?: {
    [K in keyof T]: K extends WritableKeysOf<T>
      ? T[K] extends Object
        ? Signal<Store<T[K]>>
        : Signal<T[K]>
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
- Undo/redo/reset support?
*/

/*
TODO:
- Replace store with this?
- Figure out how best to expose peek functionality and maybe underlying signal (_ vs $)
- Proxy vs object with descriptors?
*/
export const state = <T extends Object>(initialState: T) => {
  const result = Object.create(null)

  Object.keys(initialState).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(initialState, key)!
    if (descriptor.get) {
      const prop = computed(descriptor.get.bind(result))
      Object.defineProperty(result, key, {
        enumerable: true,
        get() {
          return prop.get()
        },
      })
      Object.defineProperty(result, key + '$', {
        get() {
          return prop.peek
        },
      })
      return
    } else {
      const prop = signal(descriptor.value)
      Object.defineProperty(result, key, {
        enumerable: true,
        get() {
          return prop.get()
        },
        set(value) {
          prop.set(value)
        },
      })
      Object.defineProperty(result, key + '$', {
        get() {
          return prop.peek
        },
      })
    }
  })
  return result as T & {
    [K in keyof T as `${string & K}$`]: T[K]
  }
}

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
  const signalMap: { [keyPath: string]: SignalBase<any> } = {}
  const recursivelyUpdateSignals = (obj: any, keyPathPrefix = '') => {
    Object.keys(obj).forEach((key) => {
      const keyPath = `${keyPathPrefix}.${key}`
      const sig = signalMap[keyPath]
      if (sig instanceof Signal) {
        sig.set(obj[key])
      } else {
        signalMap[keyPath] = signal(obj[key])
      }
      if (obj[key] instanceof Object) {
        recursivelyUpdateSignals(obj[key], keyPath)
      }
    })
    if (Array.isArray(obj)) {
      signalMap[keyPathPrefix + '.length'] = computed(() => obj.length)
    }
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
        const sig = (signalMap[keyPath] = signal(value))
        return sig
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
        const sig = signalMap[keyPath]
        let newValue = value
        batch(() => {
          if (value instanceof Object) {
            newValue = createProxy(value, keyPath)
            recursivelyUpdateSignals(value, keyPath)
          }
          if (sig instanceof Signal) {
            sig.set(newValue)
          } else {
            signalMap[keyPath] = signal(newValue)
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
