import { BooleanAttributePart } from 'lit-html'
import { AttributePart } from 'lit-html'
import {
  PartType,
  PropertyPart,
  directive,
  type PartInfo,
} from 'lit-html/directive.js'
import { Signal } from '../Signal'
import { ObserveDirective } from './ObserveDirective'

export class BindDirective extends ObserveDirective {
  constructor(partInfo: PartInfo) {
    super(partInfo)
    if (
      !(
        [
          PartType.ATTRIBUTE,
          PartType.BOOLEAN_ATTRIBUTE,
          PartType.PROPERTY,
        ] as PartType[]
      ).includes(partInfo.type)
    ) {
      throw new Error(
        'bind can only be used for attributes, boolean attributes, and properties.'
      )
    }
  }

  // Restrict type to only Signal
  declare observable: Signal<unknown> | undefined

  event = ''
  handler = () => {}

  render(signal: Signal<any>, event = 'input') {
    this.event = event
    return super.render(signal)
  }

  update(
    part: PropertyPart | AttributePart | BooleanAttributePart,
    [signal, event = 'input']: [Signal<any>, string | undefined]
  ) {
    if (event !== this.event) {
      const el = part.element
      el.removeEventListener(this.event, this.handler)

      const property = part.name

      const handler = (e: Event) => {
        this.observable?.set(
          (e.target as HTMLElement)?.[property as keyof HTMLElement]
        )
      }
      el.addEventListener(event, handler)

      return this.render(signal)
    }
  }
}

/**
 * Binds a signal to an element's property or attribute. Defaults to input event, but
 * can be changed by passing a second argument matching the event name (without 'on').
 */
export const bind = directive(BindDirective)
