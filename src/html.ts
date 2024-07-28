import { SignalBase } from './Signal'
import { suppressFalseAsText } from './directives'
import { func } from './directives/FunctionDirective'
import { observe } from './directives/ObserveDirective'
import { html as litHtml } from 'lit-html'

export const html = (strings: TemplateStringsArray, ...values: unknown[]) => {
  const litValues = values.map((v) => {
    if (v instanceof SignalBase) {
      return observe(v)
    }
    if (v instanceof Function) {
      return func(v)
    }
    if (v === false) {
      return suppressFalseAsText()
    }
    return v
  })
  return litHtml(strings, ...litValues)
}
