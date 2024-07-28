TODO: Add this back when context actually works.

## Context

Context lets you share values deep in the component tree without having to pass props. Create a context with `createContext` and provide a value to a callback's call stack with the `.provide` method on the returned context object. Consume the value with the `.value` getter property.

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
