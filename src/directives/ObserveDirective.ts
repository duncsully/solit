import { noChange, nothing } from 'lit-html'
import {
  AsyncDirective,
  directive,
  PartInfo,
  PartType,
} from 'lit-html/async-directive.js'

export type Observable<T> = {
  subscribe: (callback: (value: T) => void) => () => void
}

export class ObserveDirective extends AsyncDirective {
  constructor(part: PartInfo) {
    super(part)
    this.isChildPart = part.type === PartType.CHILD
  }

  isChildPart = false
  observable: Observable<unknown> | undefined
  unsubscribe: (() => void) | undefined

  render(observable: Observable<unknown>) {
    if (this.observable !== observable) {
      this.unsubscribe?.()
      this.observable = observable
      if (this.isConnected) {
        this.subscribe()
      }
    }
    return noChange
  }

  sync = (newValue: unknown) => {
    this.setValue(this.isChildPart && newValue === false ? nothing : newValue)
  }

  subscribe() {
    this.unsubscribe = this.observable!.subscribe(this.sync)
  }

  disconnected() {
    this.unsubscribe!()
  }

  reconnected() {
    this.subscribe()
  }
}

/**
 * A directive to subscribe a lit-html part to the passed observable object (e.g. a signal)
 */
export const observe = directive(ObserveDirective)
