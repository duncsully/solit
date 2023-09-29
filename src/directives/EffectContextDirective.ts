import { AsyncDirective, directive } from 'lit/async-directive.js'
import { TemplateResult } from 'lit'
import { Effect, watch } from '../Observable'

/**
 * A stack of effects that are tied to the next context
 */
const effectsStack = [[]] as Effect[][]

class EffectContextDirective extends AsyncDirective {
  effects = [] as Effect[]
  cleanUps = [] as Function[]

  render(template: TemplateResult) {
    this.effects = effectsStack.pop() ?? []
    this.setWatchers()
    effectsStack.push([])
    return template
  }

  disconnected() {
    this.cleanUps.forEach((cleanup) => {
      cleanup()
    })
    this.cleanUps = []
  }

  reconnected() {
    this.setWatchers()
  }

  protected setWatchers() {
    this.cleanUps = this.effects.map((effect) => watch(effect))
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
