import { observe } from './ObserveDirective'
import { AsyncDirective, PartType, directive } from 'lit/async-directive.js'
import { batch, computed } from '../state'

class FunctionDirective extends AsyncDirective {
  constructor(partInfo: any) {
    super(partInfo)
    if (partInfo.type === PartType.EVENT) {
      this.run = false
    }
  }
  run = true
  render(func: Function) {
    return this.run
      ? observe(computed(func as () => void))
      : (...forward: unknown[]) => {
          let result: unknown
          batch(() => {
            result = func(...forward)
          })
          return result
        }
  }
}
/**
 * A directive to wrap a function and automatically observe any states
 * used within it, rerendering the template part when they change. Also
 * wraps event handlers in an action so updates are batched.
 */
export const func = directive(FunctionDirective)
