import { noChange } from 'lit-html'
import { AsyncDirective, directive } from 'lit-html/async-directive.js'

export type Observable<T> = {
  subscribe: (callback: (value: T) => void) => () => void
}

export class ObserveDirective extends AsyncDirective {
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

  subscribe() {
    this.unsubscribe = this.observable!.subscribe(this.setValue.bind(this))
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
