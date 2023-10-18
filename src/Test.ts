import { effect } from './directives/EffectContextDirective'
import { styleMap } from 'lit/directives/style-map.js'
import { Writable, computed, state } from './Observable'
import { repeat } from 'lit/directives/repeat.js'
import { html } from './html'
import { render } from 'lit'

/*
How it works:
A "component" is just a function that returns an html template. Optionally
it can accept props which come in two forms:
    * Static values - These don't change between template renders. Think of
        them as "configurations" or SSR props.
    * Sates - These are values that can change between renders. They are
        "reactive" and will surgically update the templates wherever they
        are used.

It can also call effects, which are just functions that run when the
component is mounted and when any of its states change.
*/

/* const partial = (strings: TemplateStringsArray, ...values: unknown[]) => {
  const litValues = values.map((v) => {
    if (v instanceof Observable) {
      return observe(v)
    }
    if (v instanceof Function) {
      return func(v)
    }
    return v
  })
  return litHtml(strings, ...litValues)
} */

export const Test = (label: string, start: number = 0) => {
  const count = state(start, { name: 'count' })

  effect(() => {
    console.log('count is now', count.get())

    return () => console.log('cleaning up count effect')
  })

  const doubled = computed(() => count.get() * 2, { name: 'doubled' })

  effect(() => {
    console.log('doubled is now', doubled.get())
    return () => console.log('cleaning up doubled effect')
  })

  const handleClick = () => {
    count.set(count.get() + 1)
  }

  return html`<button @click=${handleClick}>${label} ${count}</button>`
}

/* const Doubled = (count: Writable<number>) => {
  const doubled = computed(() => count.get() * 2)

  effect(() => {
    console.log('doubled is now', doubled.get())
    return () => console.log('cleaning up doubled effect')
  })

  return html`<div>Doubled: ${doubled}</div>`
} */

const sharedState = state(0)

export const Shared = () => {
  const handleClick = () => {
    sharedState.set(sharedState.get() + 1)
  }

  return html`<button @click=${handleClick}>
    shared count is ${sharedState}
  </button>`
}

const MemoryLeakTest = () => {
  const count = state(0)
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

const todos = state(
  {} as { label: Writable<string>; checked: Writable<boolean>; id: number }[]
)

export const TodoList = () => {
  const addTodo = () => {
    todos.update((before) => {
      const id = Date.now()
      return {
        ...before,
        [id]: {
          label: state(''),
          checked: state(false),
          id,
        },
      }
    })
  }

  const toRender = computed(
    () =>
      html`${repeat(
        Object.values(todos.get()),
        (todo) => todo.id,
        (todo) => TodoItem(todo.id)
      )}`
  )

  return html`
    <div style=${styleMap({ display: 'flex', flexDirection: 'column' })}>
      ${toRender}
    </div>
    <button @click=${addTodo}>Add Todo</button>
  `
}

export const TodoItem = (id: number) => {
  const todo = todos.get()[id]
  const getStyles = () =>
    styleMap({
      textDecoration: todo.checked.get() ? 'line-through' : 'none',
    })

  effect(() => {
    console.log('checked:', todo.checked.get())
  })

  return html`
    <div>
      <input
        type="checkbox"
        .checked=${todo.checked}
        @change=${(e: any) => {
          todo.checked.set(e.target.checked)
        }}
      />
      <input
        type="text"
        .value=${todo.label}
        style=${getStyles}
        @change=${(e: any) => {
          todo.label.set(e.target.value)
        }}
      />
    </div>
  `
}

export const App = () => {
  return TodoList()
}

render(App(), document.body)

/*
To do:
- Cache option to count number of times used vs last time used? Nah, default to frequency, tiebreak by newness
- Better logic for tying effect to component, not just the next template
- Consider how router would work, especially prefetching
- Post-render effects
- Promise support? 
- Web component generation:
  - Function:
    - 0: name
    - 1: component function
    - 2?: attribute transformer map:
      - key: attribute name
      - value: function that transforms string attribute value to state value
  - Automatically create state for props?
  - Use LitElement?
*/
