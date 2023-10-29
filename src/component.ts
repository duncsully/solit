import { Effect, watch } from './Observable'
import { TemplateResult } from 'lit-html'
import { Directive, PartInfo, directive } from 'lit/directive.js'

const effectContext = [] as Effect[][]

export const effect = (callback: Effect, name: string = 'effect') => {
  effectContext.at(-1)?.push(callback)
}

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

      protected runEffects() {
        this.cleanups = effects.map((effectCb) => watch(effectCb))
      }

      protected disconnected(): void {
        this.cleanups.forEach((cleanup) => cleanup?.())
      }

      protected reconnected(): void {
        this.runEffects()
      }
    }
    return directive(Component)()
  }
