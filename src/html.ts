import { Observable } from './Observable'
import { func } from './directives/FunctionDirective'
import { observe } from './directives/ObserveDirective'
import { html as litHtml } from 'lit-html'

export const html = (strings: TemplateStringsArray, ...values: unknown[]) => {
  const litValues = values.map((v) => {
    if (v instanceof Observable) {
      return observe(v)
    }
    if (v instanceof Function) {
      return func(v)
    }
    return v
  })
  return litHtml(strings, ...litValues)
}
