import { Computed, Writable, computed, state } from './Observable'

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
  [K in keyof T]: K extends WritableKeysOf<T>
    ? T[K] extends Object
      ? Writable<Store<T[K]>>
      : Writable<T[K]>
    : Computed<T[K]>
}

/* 
TODO:
- Handle setters?
- Provide a function to just transform object into observables?
 - Provide a way to access underlying observable methods from store?
- Observable registry:
 - Store observables by an arbitrary ID else fallback to UUID. This would allow
   for observables to track each other by ID rather than by reference, so that
   they can be replaced in nested objects, and so they can be serialized. e.g.

   const someStore = { a: { nested: 2 }}
   const { nested } = someStore.a.get()
   // if nested is passed by reference to a child component, and someStore.a.nested
   // gets replaced, then the child component will still be subscribed to the old
   // nested observable. If nested is tracked by ID, then it can be replaced and
   // the child component will still be subscribed to the new nested observable
   To think about, should the same Observable be used and its value merely updated
   or should a new Observable be created and the old one unsubscribed from?
   Also, should we not wrap objects in observables? 
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
export const store = <T extends Object>(initialState: T) => {
  const createObjectWrapper = (obj: any) => {
    const result = Object.create(null)
    Object.keys(obj).forEach((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(obj, key)!
      if (descriptor.get) {
        const prop = computed(descriptor.get!.bind(result))
        Object.defineProperty(result, key, {
          enumerable: true,
          get() {
            return prop.get!()
          },
        })
        return
      } else {
        let value = descriptor.value
        if (value instanceof Object) {
          value = createObjectWrapper(value)
        }
        const prop = state(value)
        Object.defineProperty(result, key, {
          enumerable: true,
          get() {
            return prop.get()
          },
          set(value) {
            const newValue =
              value instanceof Object ? createObjectWrapper(value) : value
            prop.set(newValue)
          },
        })
      }
    })
    return result
  }
  const result = createObjectWrapper(initialState) as T
  return result
}
