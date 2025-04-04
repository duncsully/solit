import { render } from 'lit-html'
import { html } from '../html'
import { Router, setupHistoryRouting } from '../Routes'
import { Klondike } from './klondike/Klondike'
import viteConfig from '../../vite-site.config'

const routes = () => {
  setupHistoryRouting({ base: viteConfig.base })

  return html`
    ${Router({
      '/': () => html`<h1>Games!</h1>
        <nav style="display: flex; gap: 16px;">
          <a href="/klondike">Klondike</a>
        </nav>`,
      '/klondike': Klondike,
    })}
  `
}

render(routes(), document.body)
