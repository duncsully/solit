import { describe, expect, it, vi } from 'vitest'
import { signal } from './signals/Signal'
import { computed } from './signals/ComputedSignal'
import { render } from 'lit-html'
import { html } from './html'

describe('html', () => {
  it('accepts signals and updates the DOM when they do', () => {
    const sig = signal('Test')
    const el = html`<p>${sig}</p>`
    render(el, window.document.body)

    expect(window.document.body.children[0]).toMatchObject({
      tagName: 'P',
      textContent: 'Test',
    })

    sig.set('Updated')

    expect(window.document.body.children[0]).toMatchObject({
      tagName: 'P',
      textContent: 'Updated',
    })
  })

  it('accepts get method of signals and updates the DOM when signal updates', () => {
    const sig = signal('Test')
    const el = html`<p>${sig.get}</p>`
    render(el, window.document.body)

    expect(window.document.body.children[0]).toMatchObject({
      tagName: 'P',
      textContent: 'Test',
    })

    sig.set('Updated')

    expect(window.document.body.children[0]).toMatchObject({
      tagName: 'P',
      textContent: 'Updated',
    })
  })

  it('accepts functions and treats them as computed signals', () => {
    const sig = signal('Test')
    const el = html`<p>${() => sig.value}</p>`
    render(el, window.document.body)

    expect(window.document.body.children[0]).toMatchObject({
      tagName: 'P',
      textContent: 'Test',
    })

    sig.set('Updated')

    expect(window.document.body.children[0]).toMatchObject({
      tagName: 'P',
      textContent: 'Updated',
    })
  })

  it('automatically batches event handlers', () => {
    const width = signal(2)
    const length = signal(4)
    const area = computed(() => width.value * length.value)

    const subscriber = vi.fn()
    area.subscribe(subscriber)
    subscriber.mockClear()

    const el = html`<button
      @click=${() => {
        width.set(4)
        length.set(2)
      }}
    ></button>`
    render(el, window.document.body)
    ;(window.document.body.children[0] as HTMLButtonElement).click()

    expect(subscriber).not.toHaveBeenCalled()
  })

  it('does not render false as a text node', () => {
    const shouldRender = false
    const computedValue = computed(() => shouldRender && 'Should not render')
    const el = html`<p>Hello world!</p>
      <p>${shouldRender && 'Should not render'}</p>
      <p>${computedValue}</p>`
    render(el, window.document.body)

    expect(window.document.body.children[0]).toMatchObject({
      tagName: 'P',
      textContent: 'Hello world!',
    })
    expect(window.document.body.children[1]).toMatchObject({
      tagName: 'P',
      textContent: '',
    })
    expect(window.document.body.children[2]).toMatchObject({
      tagName: 'P',
      textContent: '',
    })
  })
})
