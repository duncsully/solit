import { render } from 'lit'
import { Klondike } from './Klondike'
import { html } from '../html'
import { Routes } from '../Routes'
import { Test } from '../Test'

render(
  html`
    ${Routes({
      '': () => html`<a href="/klondike">Klondike Solitaire</a>
        <a href="/test">Testing</a>`,
      klondike: Klondike,
      test: Test,
    })}
  `,
  document.body
)
