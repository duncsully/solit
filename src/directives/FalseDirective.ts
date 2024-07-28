import { nothing } from 'lit-html'
import { directive, Directive, PartInfo, PartType } from 'lit-html/directive.js'

/**
 * A simple directive to suppress rendering `false` as a text node.
 * This allows for conditional rendering without using a ternary or
 * the `when` directive.
 *
 * @example
 * ```ts
 * // Renders <div></div> if shouldGreet is false
 * html`<div>${shouldGreet && 'Hello world!'}</div>`
 * ```
 */
export class FalseDirective extends Directive {
  constructor(partInfo: PartInfo) {
    super(partInfo)
    this.shouldRender = partInfo.type !== PartType.CHILD
  }

  shouldRender = true

  render() {
    return this.shouldRender ? false : nothing
  }
}

export const suppressFalseAsText = directive(FalseDirective)
