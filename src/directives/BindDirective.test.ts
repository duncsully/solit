import { describe, expect, it } from 'vitest'
import { signal } from '../Signal'
import { render } from 'lit-html'
import { html } from '../html'
import { bind } from './BindDirective'
import { getByRole } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'

describe('bind directive', () => {
  const user = userEvent.setup()

  it('should extend observe directive behavior', () => {
    const name = signal('Dave')
    render(
      html`<input type="text" .value=${bind(name)} />`,
      window.document.body
    )
    const el = getByRole(window.document.body, 'textbox') as HTMLInputElement

    expect(el.value).toBe('Dave')

    name.set('David')

    expect(el.value).toBe('David')
  })

  it('should update the signal when provided event is fired', async () => {
    const isCool = signal(false)
    render(
      html`<input type="checkbox" .checked=${bind(isCool, 'change')} />`,
      window.document.body
    )

    const el = getByRole(window.document.body, 'checkbox') as HTMLInputElement

    expect(el.checked).toBe(false)

    await user.click(el)

    expect(isCool.value).toBe(true)
  })

  it('defaults to input event', async () => {
    const name = signal('Dave')
    render(
      html`<input type="text" .value=${bind(name)} />`,
      window.document.body
    )

    const el = getByRole(window.document.body, 'textbox')

    await user.clear(el)
    await user.type(el, 'David')

    expect(name.value).toBe('David')
  })
})
