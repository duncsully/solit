import { AsyncDirective, directive } from 'lit/async-directive.js'
import { TemplateResult } from 'lit'
import { ComputedObservable, batch, computed } from '../state'

const noop = () => {}

/**
 * A stack of effects that are tied to the next context
 */
const effectsStack = [[]] as Effect[][]

export type Effect = () => void | (() => void)

class EffectContextDirective extends AsyncDirective {
  effects = [] as Effect[]
  watchers = [] as ComputedObservable<any>[]
  cleanups = new WeakMap<Function, Function>()

  render(template: TemplateResult) {
    this.effects = effectsStack.pop() ?? []
    this.effects.forEach((effect) => {
      const watcher = computed(() => {
        let cleanup = this.cleanups.get(effect)
        cleanup?.()
        if (this.isConnected) {
          batch(() => {
            const newCleanup = effect()
            if (newCleanup) {
              this.cleanups.set(effect, newCleanup)
            }
          })
        }
      })
      this.watchers.push(watcher)
      watcher.subscribe(noop)
    })
    effectsStack.push([])
    return template
  }

  disconnected() {
    this.watchers.forEach((watcher) => {
      watcher.unsubscribe(noop)
    })
    this.effects.forEach((effect) => {
      const cleanup = this.cleanups.get(effect)
      cleanup?.()
      this.cleanups.delete(effect)
    })
  }

  reconnected() {
    this.watchers.forEach((watcher) => {
      watcher.subscribe(noop)
    })
  }
}

/**
 * A directive that ties effects to their TemplateResults, running
 * effect cleanups when the template is removed from the DOM.
 */
export const effectContext = directive(EffectContextDirective)

/**
 * A hook that runs the given callback when the component is mounted
 * and when any of its observables change. If the callback returns a function,
 * it will be run when the component is unmounted and before the next
 * callback is run.
 */
export const effect = (effect: Effect) => {
  const effectsForContext = effectsStack[effectsStack.length - 1]
  effectsForContext?.push(effect)
}
