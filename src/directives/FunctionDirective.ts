import { observe } from './ObserveDirective'
import {
  AsyncDirective,
  PartInfo,
  PartType,
  directive,
} from 'lit-html/async-directive.js'
import { Computed, batch, computed, SignalBase } from '../Signal'

export class FunctionDirective extends AsyncDirective {
  static signalCache = new WeakMap<Function, Computed<any>>()
  constructor(partInfo: PartInfo) {
    super(partInfo)
    this.shouldCompute = partInfo.type !== PartType.EVENT
  }

  shouldCompute: boolean

  render(func: Function) {
    if (!this.shouldCompute) {
      return (...forward: unknown[]) => {
        return batch(() => func(...forward))
      }
    }
    const mappedSignal = SignalBase._getToSignalMap.get(func as () => void)
    if (mappedSignal) {
      return observe(mappedSignal)
    }
    if (!FunctionDirective.signalCache.has(func)) {
      FunctionDirective.signalCache.set(func, computed(func as () => void))
    }
    return observe(FunctionDirective.signalCache.get(func)!)
  }
}
/**
 * A directive to wrap a function and automatically observe any states
 * used within it, rerendering the template part when they change. Also
 * wraps event handlers in an action so updates are batched.
 */
export const func = directive(FunctionDirective)
