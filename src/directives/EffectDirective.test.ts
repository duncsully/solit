import { describe, expect, it, vi } from 'vitest'
import { html } from '../html'
import { render } from 'lit-html'
import { signal } from '../Signal'
import { ref } from 'lit-html/directives/ref.js'
import { effects } from './EffectDirective'

describe('effects', () => {
  it('runs effects on mount', () => {
    const effectCheck = vi.fn()
    const Test = () => {
      return html`<p ${effects(effectCheck)}>Test</p>`
    }
    render(Test(), window.document.body)

    expect(effectCheck).toHaveBeenCalledTimes(1)
  })

  it('runs returned cleanup function on unmount', () => {
    const cleanupCheck = vi.fn()
    const Test = () => {
      const effectWithCleanup = () => cleanupCheck
      return html`<p ${effects(effectWithCleanup)}>Test</p>`
    }
    const el = Test()
    render(el, window.document.body)
    render(html``, window.document.body)

    expect(cleanupCheck).toHaveBeenCalledTimes(1)
  })

  it('runs cleanup and effect when any signal dependencies change', () => {
    const sig = signal('Test')
    const effectCheck = vi.fn()
    const cleanupCheck = vi.fn()
    const Test = () => {
      const effect = () => {
        effectCheck(sig.value)
        return cleanupCheck
      }
      return html`<p ${effects(effect)}>${sig}</p>`
    }
    render(Test(), window.document.body)

    expect(effectCheck).toHaveBeenCalledTimes(1)
    expect(cleanupCheck).toHaveBeenCalledTimes(0)

    sig.set('Updated')

    expect(effectCheck).toHaveBeenCalledTimes(2)
    expect(cleanupCheck).toHaveBeenCalledTimes(1)
  })
})
