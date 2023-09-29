import { TemplateResult, html as litHtml, nothing } from 'lit'
import { observe } from './directives/ObserveDirective'
import { effect, effectContext } from './directives/EffectContextDirective'
import { styleMap } from 'lit/directives/style-map.js'
import { func } from './directives/FunctionDirective'
import { Observable, Writable, computed, state } from './Observable'

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

const partial = (strings: TemplateStringsArray, ...values: unknown[]) => {
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
}

const html = (strings: TemplateStringsArray, ...values: unknown[]) => {
  const litValues = values.map((v) => {
    if (v instanceof Observable) {
      return observe(v)
    }
    if (v instanceof Function) {
      return func(v)
    }
    return v
  })
  return effectContext(litHtml(strings, ...litValues)) as TemplateResult
}

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

const Doubled = (count: Writable<number>) => {
  const doubled = computed(() => count.get() * 2)

  effect(() => {
    console.log('doubled is now', doubled.get())
    return () => console.log('cleaning up doubled effect')
  })

  return html`<div>Doubled: ${doubled}</div>`
}

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

export const App = () => {
  return html`${MemoryLeakTest()} ${TodoList()} `
}

export const TodoList = () => {
  const todos = state([
    { label: 'Test', checked: state(false) },
    { label: 'Test 2', checked: state(true) },
  ])

  const addTodo = () => {
    todos.update((before) => [
      ...before,
      { label: 'Test 3', checked: state(false) },
    ])
  }

  const toRender = computed(() =>
    todos.get().map((todo) => TodoItem(todo.label, todo.checked))
  )

  return html`
    <button @click=${addTodo}>Add Todo</button>
    <div style=${styleMap({ display: 'flex', flexDirection: 'column' })}>
      ${toRender}
    </div>
  `
}

export const TodoItem = (label: string, checked: Writable<boolean>) => {
  const getStyles = () =>
    styleMap({
      textDecoration: checked.get() ? 'line-through' : 'none',
    })

  effect(() => {
    console.log('checked:', checked.get())
  })

  return html`
    <label>
      <input
        type="checkbox"
        .checked=${checked}
        @change=${(e: any) => {
          checked.set(e.target.checked)
        }}
      />
      <span style=${getStyles}>${label}</span>
    </label>
  `
}

/*
To do:
- Move used cache entry to front of cache, pop old ones off the end
- Cache option to count number of times used vs last time used?
- Better logic for tying effect to component, not just the next template
- Consider how router would work, especially prefetching
- Post-render effects
- Better efficiency in batch operations for multiple set operations that end up back to original value?
*/
