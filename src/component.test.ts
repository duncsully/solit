import { describe, expect, it, vi } from 'vitest'
import { component, effect } from './component'
import { html } from './html'
import { render } from 'lit'
import { signal } from './Signal'

describe('component', () => {
  it('returns the template from the callback', () => {
    const Test = component(() => html`<p>Test</p>`)
    render(Test(), window.document.body)

    expect(window.document.body.children[0]).toMatchObject({
      tagName: 'P',
      textContent: 'Test',
    })
  })

  it('runs effect on mount', () => {
    const effectCheck = vi.fn()
    const Test = component(() => {
      effect(effectCheck)
      return html`<p>Test</p>`
    })
    render(Test(), window.document.body)

    expect(effectCheck).toHaveBeenCalledTimes(1)
  })

  it('runs returned cleanup function on unmount', () => {
    const cleanupCheck = vi.fn()
    const Test = component(() => {
      effect(() => cleanupCheck)
      return html`<p>Test</p>`
    })
    const el = Test()
    render(el, window.document.body)
    render(html``, window.document.body)

    expect(cleanupCheck).toHaveBeenCalledTimes(1)
  })

  it('runs cleanup and effect when any signal dependencies change', () => {
    const sig = signal('Test')
    const effectCheck = vi.fn()
    const cleanupCheck = vi.fn()
    const Test = component(() => {
      effect(() => {
        effectCheck(sig.value)
        return cleanupCheck
      })
      return html`<p>${sig}</p>`
    })
    render(Test(), window.document.body)

    expect(effectCheck).toHaveBeenCalledTimes(1)
    expect(cleanupCheck).toHaveBeenCalledTimes(0)

    sig.set('Updated')

    expect(effectCheck).toHaveBeenCalledTimes(2)
    expect(cleanupCheck).toHaveBeenCalledTimes(1)
  })
})
