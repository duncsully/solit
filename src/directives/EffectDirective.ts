import { noChange } from 'lit-html'
import { AsyncDirective, directive } from 'lit-html/async-directive.js'
import { watch, type Effect } from '../Signal'

export class EffectDirective extends AsyncDirective {
  cleanups: (() => void)[] = []
  effects: (() => (() => void) | void)[] = []

  render(...effects: Effect[]) {
    this.effects = effects
    this.runEffects()
    return noChange
  }

  protected runEffects() {
    this.cleanups = []
    this.effects.forEach((effectCb) => {
      const cleanup = watch(effectCb, effectCb.name ?? 'anon effect')
      if (cleanup) {
        this.cleanups.push(cleanup)
      }
    })
  }

  protected reconnected(): void {
    this.runEffects()
  }

  protected disconnected(): void {
    this.cleanups.forEach(Reflect.apply)
  }
}

/**
 * Runs the passed effects when the parent element is rendered, and calls the
 * returned cleanup function when the parent element is removed from the DOM.
 */
export const effects = directive(EffectDirective)
