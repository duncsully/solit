import { styleMap } from 'lit/directives/style-map.js'
import { Writable, computed, state } from './Observable'
import { repeat } from 'lit/directives/repeat.js'
import { html } from './html'
import { component, effect } from './component'
import { when } from 'lit/directives/when.js'

export const Test = component((label: string, start: number = 0) => {
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
})

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

/* const MemoryLeakTest = () => {
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
} */

const todos = state(
  {} as { label: Writable<string>; checked: Writable<boolean>; id: number }[]
)

export const TodoList = () => {
  const newValue = state('')
  const addTodo = () => {
    todos.update((before) => {
      const id = Date.now()
      return {
        ...before,
        [id]: {
          label: state(newValue.peek()),
          checked: state(false),
          id,
        },
      }
    })
    newValue.set('')
  }

  const handleChange = (e: any) => {
    newValue.set(e.target.value)
  }

  const handleKeyup = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTodo()
    } else {
      newValue.set((e.target as HTMLInputElement)?.value)
    }
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
    <div
      style=${styleMap({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      })}
    >
      ${toRender}
      <input
        type="text"
        placeholder="Add a todo"
        .value=${newValue}
        @change=${handleChange}
        @keyup=${handleKeyup}
      />
    </div>
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

const Nesteder = component(() => {
  const count = state(0)
  effect(() => {
    console.log('running effect 1.1.1')
    console.log('inner count is', count.get())
    return () => console.log('cleaning up effect 1.1.1')
  })
  return html`<div>
    subtemplate 1.1.1<button @click=${() => count.update((value) => value + 1)}>
      Increment
    </button>
  </div>`
})

const NestedEffectTest = component((count: Writable<number>) => {
  effect(() => {
    console.log('running effect 1.1')
    // Passed in from parent
    console.log('outer count is', count.get())
    return () => console.log('cleaning up effect 1.1')
  })

  return html`<div>subtemplate 1.1</div>
    ${Nesteder()}`
})

const EffectTest = component(() => {
  const showingSubtemplate = state(true)
  const count = state(0)
  effect(() => {
    console.log('running effect 1')
    return () => console.log('cleaning up effect 1')
  })

  const subtemplate = NestedEffectTest(count)

  effect(() => {
    return () => console.log('cleaning up effect 2')
  })

  return html`
    <button @click=${() => showingSubtemplate.update((current) => !current)}>
      Toggle subtemplate
    </button>
    <button @click=${() => (count.value += 1)}>Increment</button>
    <p>count: ${count}</p>
    <div>template 1</div>
    ${() => when(showingSubtemplate.get(), () => subtemplate)}
  `
})

export const App = () => {
  return EffectTest()
}

/*
To do:
- Post-render effects without using ref?
- Batch undo? Any change to a state should be undoable, and
  any changes during a batch should all be undoable in one go.
*/
