# SoLit

Solid, but with lit-html. "Components" are just functions that setup reactive lit-html templates. State and effects are managed with writable and computed signals that automatically track dependent signals. No JSX, no manual dependency tracking, no rules of hooks, no VDOM, no compiler.

## Primitives

Only five primitives are needed to build reactive components:

- `state(initialValue)` - a writable signal that tracks its dependents
- `computed(getter)` - a read-only signal that tracks its dependents and is lazily evaluated
- `effect(callback)` - a callback that is run when its dependents change, optionally running a returned cleanup callback
- `html` - a tagged template literal that renders a lit-html template
- `render(template, container)` - a function that renders a lit-html template to a container

## Example

```ts
import { state, computed, effect, html, render } from 'solit'

const Counter = () => {
  const count = state(0)
  const double = computed(() => count.get() * 2)

  effect(() => {
    console.log('doubled:', double.get())

    return () => {
      console.log('cleaning up doubled effect')
    }
  })

  const increment = () => count.update((current) => current + 1)

  return html`
    <div>
      <button onclick=${increment}>Increment</button>
      <!-- Signals can be passed directly in -->
      <p>Count: ${count}</p>
      <p>Double: ${double}</p>
      <!-- Functions are reactive to any signal updates inside of them -->
      <p>Triple: ${() => count.get() * 3}</p>
    </div>
  `
}
render(Counter(), document.body)
```

## Signals

Signals are the state management solution in SoLit. There are writable signals created with `state(initialValue)` and computed signals created with `computed(getter)`. They both have the following common methods:

- `get()` - returns the current value. When used inside of a computed signal's getter, an effect, or a function inside of a template, the signal is automatically tracked as a dependency.
- `peak()` - returns the current value without tracking it as a dependency
- `subscribe(callback)` - subscribes to changes to the current value, returns an unsubscribe function, and immediately calls the callback with the current value
- `observe(callback)` - subscribes to changes to the current value, returns an unsubscribe function, but does not immediately call the callback with the current value
- `unsubscribe(callback)` - unsubscribes a callback from changes to the current value

Writable signals additionally have the following methods:

- `set(value)` - sets the current value
- `update(updater)` - updates the current value with an updater function that is passed the current value and returns the new value
- `reset()` - resets the current value to the initial value

Computed signals are optimized to only compute when their values are requested, either by calling their `get()` or `peak()` method directly or if they have subscribers, and then this value is memoized for as long as dependencies don't update.

## Templates

Templates are built using a slightly enhanced version of lit-html. The `html` template literal tagging function is used to create a template that can be rendered with the `render` function. [Read more about lit-html here.](https://lit.dev/docs/libraries/standalone-templates/) `html` has the following enhancements:

- Signals can be passed directly in and will automatically and surgically update the DOM when they change
- Functions are reactive to any signal updates inside of them, likewise surgically updating the DOM
- Functions used as event handlers via `@eventname=${someFunction}` will automatically batch signal updates so that change diffing the signals is deferred until all signal updates have been processed, preventing unnecessary DOM updates

## Advanced

Signals are considered changed using Object.is by default. You can override this behavior by passing a custom `hasChanged` option.

```ts
const array = state([1], {
  hasChanged: (a, b) => a.some((value, i) => value !== b[i]),
})

array.set([1]) // no change

array.update((current) => {
  current.push(2)
  return current
}) // changed
```

Computed signals by default only memoize their current dependency values (i.e. it will only compute once for the current set of dependencies). You can optionally choose to store past computations by passing an integer to the `cache` option to save that many computations.

```ts
const count = state(0)
const doubled = computed(() => count.get() * 2, { cache: 3 }) // A super expensive computation, right?
doubled.subscribe(console.log) // Computed 1st time -> 0, cached 0 -> 0
count.set(1) // Computed 2nd time -> 2, cached 0 -> 0, 1 -> 2
count.set(2) // Computed 3rd time -> 4, cached 0 -> 0, 1 -> 2, 2 -> 4
count.set(1) // Read from cache 1 -> 2
count.set(3) // Computed 4th time -> 8, cache size exceeded, removed 0 -> 0, cached 1 -> 2, 2 -> 4, 3 -> 6
```

```

```
