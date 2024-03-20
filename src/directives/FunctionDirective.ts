import { observe } from './ObserveDirective'
import {
  AsyncDirective,
  PartInfo,
  PartType,
  directive,
} from 'lit/async-directive.js'
import { batch, computed } from '../Signal'

class FunctionDirective extends AsyncDirective {
  constructor(partInfo: PartInfo) {
    super(partInfo)
    this.shouldCompute = partInfo.type !== PartType.EVENT
  }

  shouldCompute: boolean

  render(func: Function) {
    return this.shouldCompute
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
