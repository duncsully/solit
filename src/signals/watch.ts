import { computed } from './ComputedSignal'
import { batch } from './Signal'

export type Effect = () => void | (() => void)

/**
 * Call the passed callback immediately and whenever any of its signal
 * dependencies change. Optionally return a cleanup function and it will be
 * called before the next time the callback is called or when the watcher is
 * unsubscribed.
 * @param callback
 * @param [name=watcher] - Optional name for debugging purposes
 * @returns A function that unsubscribes the watcher
 */
export const watch = (callback: Effect, name: string = 'watcher') => {
  let cleanup: (() => void) | void
  const watcher = computed(
    () => {
      batch(() => {
        cleanup?.()
        cleanup = callback()
      })
    },
    { name, hasChanged: () => true }
  )
  const unsubscribe = watcher.subscribe(() => {})
  return () => {
    unsubscribe()
    cleanup?.()
  }
}
