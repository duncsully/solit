import { styleMap } from 'lit-html/directives/style-map.js'
import { Signal, computed, signal } from './Signal'
import { repeat } from 'lit-html/directives/repeat.js'
import { html } from './html'
import { when } from 'lit-html/directives/when.js'
import { HTMLTemplateResult, render } from 'lit-html'
import { Router, setupHistoryRouting } from './Routes'
import { store } from './store'
import { effects } from './directives/EffectDirective'
import { createContext } from './context'

const Hexagon = () => {
  const containerStyles = styleMap({
    marginLeft: '12px',
    height: '40px',
    borderTop: '2px solid black',
    borderBottom: '2px solid black',
    position: 'relative',
    background: 'lightgray',
  })

  const commonLineStyle = {
    position: 'absolute',
    width: '10px',
    height: '57.74%',
    background: 'lightgray',
  }

  const topLeftLineStyles = styleMap({
    ...commonLineStyle,
    top: '0',
    left: '0',
    transformOrigin: 'top left',
    transform: 'rotate(30deg)',
    borderLeft: '2px solid black',
  })

  const bottomLeftLineStyles = styleMap({
    ...commonLineStyle,
    bottom: '0',
    left: '0',
    transformOrigin: 'bottom left',
    transform: 'rotate(-30deg)',
    borderLeft: '2px solid black',
  })
  return html`
    <div style=${containerStyles}>
      <div style=${topLeftLineStyles}></div>
      <div style=${bottomLeftLineStyles}></div>
    </div>
  `
}

export const Test = (label: string, start: number = 0) => {
  const count = signal(start, { name: 'count' })

  const logCount = () => {
    console.log('count is now', count.get())

    return () => console.log('cleaning up count effect')
  }

  const doubled = computed(() => count.get() * 2, { name: 'doubled' })

  const logDoubled = () => {
    console.log('doubled is now', doubled.get())
    return () => console.log('cleaning up doubled effect')
  }

  const handleClick = () => {
    count.set(count.get() + 1)
  }

  return html`<button ${effects(logCount, logDoubled)} @click=${handleClick}>
      ${label} ${count}
    </button>
    <div style="margin-top: 16px; width: 200px;">${Hexagon()}</div>`
}

/* const Doubled = (count: Writable<number>) => {
  const doubled = computed(() => count.get() * 2)

  effect(() => {
    console.log('doubled is now', doubled.get())
    return () => console.log('cleaning up doubled effect')
  })

  return html`<div>Doubled: ${doubled}</div>`
} */

const sharedState = signal(0)

export const Shared = () => {
  const handleClick = () => {
    sharedState.set(sharedState.get() + 1)
  }

  return html`<button @click=${handleClick}>
    shared count is ${sharedState}
  </button>`
}

const MemoryLeakTest = () => {
  const count = signal(0)
  console.log(count)
  return html`<button
      @click=${() => {
        Array.from({ length: 1000 }).forEach(() => {
          computed(() => count.get() * 2).get()
        })
      }}
    >
      Add a bunch of computeds
    </button>
    <button @click=${() => count.update((value) => value + 1)}>Add</button>`
}

type Todo = {
  label: string
  done: boolean
  id: number
}
const todoStore = store({
  list: [] as Todo[],
  get doneCount() {
    return this.list.filter((todo) => todo.done).length
  },
})

export const TodoList = () => {
  const addTodo = (label: string) => {
    todoStore.list = [...todoStore.list, { label, done: false, id: Date.now() }]
  }

  function handleSubmit(e: SubmitEvent) {
    const target = e.target as HTMLFormElement
    console.log(e)
    e.preventDefault()
    addTodo((target[0] as HTMLInputElement).value)
    target.reset()
  }

  const toRender = computed(
    () =>
      html`${repeat(
        todoStore.list,
        (todo) => todo.id,
        (todo) => TodoItem(todo)
      )}`
  )

  return html`
    <div
      style=${styleMap({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      })}
    >
      ${toRender}
      <form @submit=${handleSubmit}>
        <input type="text" placeholder="Add a todo" />
      </form>
    </div>
  `
}

export const TodoItem = (todo: Todo) => {
  const getStyles = () =>
    styleMap({
      textDecoration: todo.done ? 'line-through' : 'none',
    })

  const logChecked = () => {
    console.log('checked:', todo.done)
  }

  return html`
    <div ${effects(logChecked)}>
      <input
        type="checkbox"
        .checked=${() => todo.done}
        @change=${(e: any) => {
          todo.done = e.target.checked
        }}
      />
      <input
        type="text"
        .value=${() => todo.label}
        style=${getStyles}
        @change=${(e: any) => {
          todo.label = e.target.value
        }}
      />
    </div>
  `
}

const Nesteder = () => {
  const count = signal(0)

  const logCount = () => {
    console.log('running effect 1.1.1')
    console.log('inner count is', count.get())
    return () => console.log('cleaning up effect 1.1.1')
  }

  return html`<div ${effects(logCount)}>
    subtemplate 1.1.1<button @click=${() => count.update((value) => value + 1)}>
      Increment
    </button>
  </div>`
}

const NestedEffectTest = (count: Signal<number>) => {
  const newEffect = () => {
    console.log('running effect 1.1')
    console.log('outer count is', count.get())
    return () => console.log('cleaning up effect 1.1')
  }

  return html`<div ${effects(newEffect)}>subtemplate 1.1</div>
    ${Nesteder()}`
}

const EffectTest = () => {
  const showingSubtemplate = signal(true)
  const count = signal(0)
  const effect1 = () => {
    console.log('running effect 1')
    return () => console.log('cleaning up effect 1')
  }

  const effect2 = () => {
    return () => console.log('cleaning up effect 2')
  }

  return html`
    <button
      ${effects(effect1, effect2)}
      @click=${() => showingSubtemplate.update((current) => !current)}
    >
      Toggle subtemplate
    </button>
    <button @click=${() => (count.value += 1)}>Increment</button>
    <p>count: ${count}</p>
    <div>template 1</div>
    ${() => when(showingSubtemplate.get(), () => NestedEffectTest(count))}
  `
}

const themeContext = createContext('system default')

const ContextConsumer = () => {
  const theme = themeContext.value
  return html`<div>${theme}</div>`
}

const ContextTest = () => {
  const showInner = signal(true)
  return html`
    <div>${ContextConsumer()}</div>
    ${themeContext.provide(
      'dark',
      () => html`<div>
        ${ContextConsumer()}
        ${() =>
          showInner.value && themeContext.provide('light', ContextConsumer)}
        ${ContextConsumer()}
      </div>`
    )}

    <button @click=${() => showInner.set(!showInner.get())}>
      Toggle inner
    </button>
    ${ContextConsumer()}
  `
}

export const App = () => {
  setupHistoryRouting()
  return html`
    <a href="/">Home</a>
    <a href="/effect-test">Effect test</a>
    <a href="/todo">Todo list</a>
    <a href="/leak-test">Memory leak test</a>
    <a href="/nested">Nested</a>
    <a href="/context">Context</a>
    <div>
      ${Router({
        '/': () => Test('Click me'),
        '/effect-test': EffectTest,
        '/todo': TodoList,
        '/leak-test': MemoryLeakTest,
        '/nested/*?': (props) => {
          const count = signal(0)
          return html` <button @click=${() => count.value++}>
              Count is ${count}
            </button>
            <a href="/nested">Nested</a>
            <a href="/nested/thing">Thing</a>
            <a href="/nested/thing/optional">Thing with optional</a>
            ${Router(
              {
                '/': () => html`<div>Nested</div>`,
                '/:thing/:optional?': ({ thing, optional }) =>
                  html`<div>Nested ${thing}, optional is ${optional}</div>`,
              },
              props[0]
            )}`
        },
        '/context': ContextTest,
      })}
    </div>
  `
}

render(App(), document.body)

/*
To do:
- Cache and rethrow errors in computed
- Batch effect runs, don't run immediately
- Post-render effects without using ref?
- Batch undo? Any change to a state should be undoable, and
  any changes during a batch should all be undoable in one go.
- Would the cache logic ever get it wrong?
- Single layer object and array signals?
*/

/*
Router Brainstorming:
- SSR with lit labs SSR
- Async components for waiting for data to load? 
*/
