import { Effect, watch } from './Observable'
import { TemplateResult } from 'lit-html'
import { Directive, PartInfo, directive } from 'lit/directive.js'

const effectContext = [] as Effect[][]

// TODO: ability to name effects?

export const effect = (callback: Effect) => {
  effectContext.at(-1)?.push(callback)
}

// The template should be static, but we use a directive to use its lifecycle
export const component =
  <T extends unknown[]>(callback: (...args: T) => TemplateResult) =>
  (...props: T) => {
    effectContext.push([])
    const template = callback(...props)
    const effects = effectContext.pop()!

    class Component extends Directive {
      cleanups: ReturnType<Effect>[] = []

      constructor(partInfo: PartInfo) {
        super(partInfo)
        this.runEffects()
      }

      render() {
        return template
      }

      runEffects() {
        this.cleanups = effects.map((effectCb) => watch(effectCb, 'effect'))
      }

      disconnected(): void {
        this.cleanups.forEach((cleanup) => cleanup?.())
      }

      reconnected(): void {
        this.runEffects()
      }
    }
    return directive(Component)()
  }
