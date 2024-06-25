import { noChange, type TemplateResult } from 'lit-html'
import { Effect, watch } from './Signal'
import { directive } from 'lit-html/directive.js'
import { AsyncDirective } from 'lit-html/async-directive.js'

const effectContext = [] as Effect[][]

// TODO: ability to name effects?

/**
 * Calls the given callback immediately and whenever any of its dependencies
 * change. If the callback returns a function, it will be called before calling
 * the callback again or when the component is unmounted.
 * @param callback - The callback to run, optionally returning a cleanup function
 * @example
 * ```ts
 * const count = state(0)
 * effect(() => {
 *  console.log('count is now', count.get())
 *   return () => console.log('cleaning up count effect')
 * })
 * ```
 */
export const effect = (callback: Effect) => {
  effectContext.at(-1)?.push(callback)
}

export type Component<T extends unknown[]> = (...args: T) => TemplateResult

// The template should be static, but we use a directive to use its lifecycle

/**
 * Turns a template factory into a component that can tie effects to its lifecycle.
 * @param templateFactory
 * @returns
 * @example
 * ```ts
 * const Counter = component((start = 0) => {
 *   const count = state(start)
 *   effect(() => {
 *     console.log('count is now', count.get())
 *     return () => console.log('cleaning up count effect')
 *   })
 *
 *   const handleClick = () => {
 *     count.update(value => value + 1)
 *   }
 *
 *   return html`<button @click=${handleClick}>${count}</button>`
 * })
 * ```
 */
export const component = <T extends unknown[]>(
  templateFactory: (...args: T) => TemplateResult
) =>
  directive(
    class extends AsyncDirective {
      cleanups: ReturnType<Effect>[] = []
      effects: Effect[] = []
      rendered = false

      render(...props: T) {
        if (!this.rendered) {
          effectContext.push([])
          const template = templateFactory(...props)
          this.effects = effectContext.pop()!
          this.runEffects()
          this.rendered = true
          return template
        }
        return noChange
      }

      runEffects() {
        this.cleanups = this.effects.map((effectCb) =>
          watch(effectCb, 'effect')
        )
      }

      disconnected(): void {
        this.cleanups.forEach((cleanup) => cleanup?.())
      }

      reconnected(): void {
        this.runEffects()
      }
    }
  ) as Component<T>
