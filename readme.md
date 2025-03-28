# SoLit

Solid, but with lit-html. "Components" are just functions that setup reactive lit-html templates. State and effects are managed with writable and computed signals that automatically track dependent signals. No JSX, no manual dependency tracking, no rules of hooks, no VDOM, no compiler.

Only four primitives are needed to build reactive components:

- `signal(initialValue)` - a writable signal that can be tracked by computed signals and effects
- `computed(getter)` - a computed signal that tracks its dependencies, can be tracked itself, and is lazily evaluated
- `effects(...effectCbs)` - a directive that ties all provided effect callbacks to the given element
- `html` - a template literal tagging function to build reactive lit-html templates for generating DOM

The returned template results of calling a component can then be rendered with lit-html's `render` function.

```ts
import { signal, computed, effects, html, Signal } from 'solit'
import { render } from 'lit-html'

const Counter = () => {
  const count = signal(0)

  const increment = () => count.update((current) => current + 1)

  return html`
    <div>
      <!-- Event handlers are automatically batched -->
      <button @click=${increment}>Increment</button>
      <!-- Signals can be passed directly in -->
      <p>Count: ${count}</p>
      <!-- Components are just functions that return templates -->
      ${Doubled({ count })}
      <!-- Functions are reactive to any signal updates inside of them -->
      <p>Triple: ${() => count.get() * 3}</p>
    </div>
  `
}

const Doubled = ({ count }: { count: Signal<number> }) => {
  // Automatically tracks dependency `count`
  const doubled = computed(() => count.get() * 2)

  // Define an effect
  const logDoubled = () => {
    // Accesses a signal, so it will be tracked as a dependency
    // and rerun this effect whenever it changes
    console.log('doubled:', doubled.get())

    // Runs before the next effect and when the template returned
    // by the Doubled component is removed from the DOM
    return () => {
      console.log('cleaning up doubled effect')
    }
  }

  // Bind effects to the element
  return html`<p ${effects(logDoubled)}>Double: ${doubled}</p>`
}

render(Counter(), document.body)
```

## Signals

Signals are the state management solution in SoLit. There are writable signals created with `signal(initialValue)` and computed signals created with `computed(getter)`. They both have the following common properties and methods:

- `get()` - returns the current value. When used inside of a computed signal's getter, an effect, or a function inside of a template, the signal is automatically tracked as a dependency.
- `value` - a getter property that wraps the `get` method for both computed and writable signals
- `peek` - returns the current value without tracking it as a dependency
- `subscribe(callback)` - subscribes to changes to the current value, returns an unsubscribe function, and immediately calls the callback with the current value
- `observe(callback)` - subscribes to changes to the current value, returns an unsubscribe function, but does not immediately call the callback with the current value
- `unsubscribe(callback)` - unsubscribes a callback from changes to the current value

Writable signals additionally have the following setters and methods:

- `set(value)` - sets the current value
- `value` - a setter property that wraps the `set` method
- `update(updater)` - updates the current value with an updater function that is passed the current value and returns the new value
- `reset()` - resets the current value to the initial value
- `mutate(callback)` - runs a callback that mutates the current value (typically an object or array) and then requests an update

Computed signals are optimized to only compute when their values are requested and then by default this value is memoized for as long as dependencies don't update.

## Templates

Templates are built using a slightly enhanced version of lit-html. The `html` template literal tagging function is used to create a template that can be rendered with lit-html's `render` function. [Read more about lit-html here.](https://lit.dev/docs/libraries/standalone-templates/) `html` has the following enhancements:

- `false` will not render as a text node to make conditional rendering easier
- Signals can be passed directly in and will automatically and surgically update the DOM when they change
- Functions are reactive to any signal updates inside of them, likewise surgically updating the DOM
- Functions used as event handlers via `@eventname=${someFunction}` will automatically batch signal updates so that change diffing the signals is deferred until all signal updates have been processed, preventing unnecessary DOM updates

### Effects

Effects are a way to run side effects in response to changes in signals. They are similar to the `useEffect` hook in React, but since components don't really exist at runtime in SoLit, they are not bound to a component lifecycle. Instead, they are bound to the element in the template via the `effects` directive. 

You can pass in one or more effect callbacks to the `effects` directive, and they will be run in the order they are passed in when the template is rendered. They can optionally return a cleanup function. Whenever their dependencies change, the cleanup function will be called if it exists, and then the effect will be run again. The cleanup function will also be called when the element is removed from the DOM.

### bind directive

SoLit provides a `bind` directive to two-way bind an element's attribute or property to a signal. By default it binds to the input event, but you can pass an event name as the second argument to bind to a different event.

```ts
const firstName = signal('')
const isCool = signal(false)

return html`
  <input type="text" .value=${bind(firstName)} />
  <input type="checkbox" .checked=${bind(isCool, 'change')} />
`
```

## Context

Context lets you share values deep in the component tree without having to pass props. Create a context stack with `createContext`, optionally providing a default value. Provide a value to a callback's call stack with the `.provide` method on the returned context object. Consume the most recently provided value with the `.value` getter property.

```ts
const themeContext = createContext(signal('light'))

const App = () => {
  const theme = signal('dark')
  return themeContext.provide(theme, () => {
    return html`${SomeComponent()}`
  })
}

const DeeplyNestedComponent = () => {
  const theme = themeContext.value
  return html`<div
    style=${() => ({
      color: theme.get() === 'dark' ? 'white' : 'black',
    })}
  >
    Hello
  </div>`
}
```

## Advanced

#### Comparing changes

Signals are considered changed using Object.is by default. You can override this behavior by passing a custom `hasChanged` option.

```ts
const array = signal([1], {
  hasChanged: (a, b) =>
    a.length !== b.length || a.some((value, i) => value !== b[i]),
})

array.set([1]) // no change
```

#### Mutating

You can use the `mutate` method to request an update after running the callback.

**Note:** This will require configuring the `hasChanged` option since arrays and objects will still have the same reference after mutation.

```ts
let prev = []
const array = signal([1], {
  hasChanged: (_, next) => {
    const changed =
      prev.length !== next.length || prev.some((value, i) => value !== next[i])
    prev = [...next]
    return changed
  },
})

array.mutate((current) => current.push(2)) // will update subscribers

array.mutate((current) => current.sort()) // will request update but has not changed, so will not update subscribers
```

#### Memoization

Computed signals by default only memoize the value for the most recent dependency values (i.e. it will only compute once for the current set of dependencies). That means that if the dependencies change, even to a set of values that were previously computed, the computed signal will need to recompute. You can optionally choose to store more than one previous computations by passing an integer larger than `1` to the `cacheSize` option to save that many computations. When a value is read from cache, it is moved up to the front of the cache so that it is not removed until it is the oldest value in the cache.

Alternatively, if you want to prevent memoization and always recompute values, you can pass `cacheSize: 0`.

```ts
const count = signal(0)
const doubled = computed(() => count.get() * 2, { cacheSize: 3 }) // A super expensive computation, right?
doubled.subscribe(console.log) // Computed 1st time -> 0, cached 0 -> 0
count.set(1) // Computed 2nd time -> 2, cached 0 -> 0, 1 -> 2
count.set(2) // Computed 3rd time -> 4, cached 0 -> 0, 1 -> 2, 2 -> 4
count.set(1) // Read from cache 1 -> 2
count.set(3) // Computed 4th time -> 8, cache size exceeded, removed 0 -> 0, cached 1 -> 2, 2 -> 4, 3 -> 6
```

#### computedGroup - Computing multiple values in one calculation

Sometimes you may want to create multiple computed signals that depend on the same calculation. For example, if you had a todo list that you wanted to separate into complete and incomplete todos, it'd be inefficient to filter the list twice. Instead, you can use `computedGroup` to compute multiple values in one calculation. Simply pass in your getter function that returns an object or array with the computed values, and it will return an object or array of computed signals respectively. They can be tracked individually like any other computed signal, so if a calculation only affects one of the values, only that computed signal will update its subscribers.

```ts
const todos = signal([
  { text: 'Learn JavaScript', complete: true },
  { text: 'Learn SoLit', complete: true },
  { text: 'Build something with SoLit', complete: false },
  { text: 'Contribute to SoLit', complete: false },
])

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    todos.update((current) => [
      ...current,
      { text: e.target.value, complete: false },
    ])
  }
}

const { complete, incomplete } = computedGroup(() =>
  todos.get().reduce(
    (acc, todo) => {
      if (todo.complete) {
        acc.complete.push(todo)
      } else {
        acc.incomplete.push(todo)
      }
      return acc
    },
    { complete: [], incomplete: [] }
  )
)

return html`
  <div>
    <h2>Complete</h2>
    <ul>
      <!-- Adding an incomplete todo won't rerender this -->
      ${() => complete.get().map((todo) => html`<li>${todo.text}</li>`)}
    </ul>
    <h2>Incomplete</h2>
    <ul>
      <!-- But this will get rerendered -->
      ${() => incomplete.get().map((todo) => html`<li>${todo.text}</li>`)}
    </ul>
    <input type="text" @keyup=${handleKeyUp} />
  </div>
`
```
