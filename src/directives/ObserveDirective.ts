import { noChange } from 'lit-html'
import { AsyncDirective, directive } from 'lit-html/async-directive.js'

export type Observable<T> = {
  subscribe: (callback: (value: T) => void) => () => void
}

class ObserveDirective extends AsyncDirective {
  observable: Observable<unknown> | undefined
  unsubscribe: (() => void) | undefined
  // When the observable changes, unsubscribe to the old one and
  // subscribe to the new one
  render(observable: Observable<unknown>) {
    if (this.observable !== observable) {
      this.unsubscribe?.()
      this.observable = observable
      if (this.isConnected) {
        this.subscribe(observable)
      }
    }
    return noChange
  }
  // Subscribes to the observable, calling the directive's asynchronous
  // setValue API each time the value changes
  subscribe(observable: Observable<unknown>) {
    this.unsubscribe = observable.subscribe((v: unknown) => {
      this.setValue(v)
    })
  }
  // When the directive is disconnected from the DOM, unsubscribe to ensure
  // the directive instance can be garbage collected
  disconnected() {
    this.unsubscribe!()
  }
  // If the subtree the directive is in was disconnected and subsequently
  // re-connected, re-subscribe to make the directive operable again
  reconnected() {
    this.subscribe(this.observable!)
  }
}
export const observe = directive(ObserveDirective)
