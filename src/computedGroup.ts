import { ComputedSignal, computed } from './signals/ComputedSignal'

type Return<T> = T extends Array<infer V>
  ? ComputedSignal<V>[]
  : { [K in keyof T]: ComputedSignal<T[K]> }

export function computedGroup<T extends object | unknown[]>(getter: () => T) {
  const whole = computed(getter)
  const wholeValue = whole.get()
  if (Array.isArray(wholeValue)) {
    return wholeValue.map((_, i) =>
      computed(() => whole.get()[i as keyof T])
    ) as Return<T>
  }
  return Object.keys(whole.get()).reduce((acc, key) => {
    acc[key as keyof T] = computed(() => whole.get()[key as keyof T])
    return acc
  }, {} as { [K in keyof T]: ComputedSignal<T[K]> }) as Return<T>
}
