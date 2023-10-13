import { Observable } from './Observable'
import { effectContext } from './directives/EffectContextDirective'
import { func } from './directives/FunctionDirective'
import { observe } from './directives/ObserveDirective'
import { TemplateResult, html as litHtml } from 'lit-html'

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
  return effectContext(litHtml(strings, ...litValues)) as TemplateResult
}
