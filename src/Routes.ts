import { nothing } from 'lit'
import { Component } from './component'
import { html } from './html'
import { batch, computed, state } from './Observable'

type ParamIfRequired<T> = T extends `${string}?` ? never : T
type ParamIfOptional<T> = T extends `${infer Param}?` ? Param : never

// type for extracting params from path
type PathParams<T extends string | number | symbol> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? ParamIfRequired<Param> | PathParams<Rest>
    : T extends `${string}:${infer Param}`
    ? ParamIfRequired<Param>
    : never

type OptionalPathParams<T extends string | number | symbol> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? ParamIfOptional<Param> | OptionalPathParams<Rest>
    : T extends `${string}:${infer Param}`
    ? ParamIfOptional<Param>
    : never

type ParamMap<T extends string> = {
  [K in PathParams<T>]: string
} & {
  [K in OptionalPathParams<T>]?: string
}

type RouteMap<T> = {
  [K in keyof T & string]: T[K] extends Component<[ParamMap<K>]>
    ? Component<[ParamMap<K>]>
    : never
}

// TODO handle explicit * parts
// TODO better type checking to prevent invalid routes
// TODO Way to load data before returning for SSR?
// TODO types for * parts
// TODO test route priority, probably ought to sort them by specificity

// @ts-ignore
globalThis.URLPattern ??= await import('urlpattern-polyfill')

const startingPath = state(window.location.hash.slice(1))
const remainingPath = state(window.location.hash.slice(1))
const setPath = (path: string) => {
  batch(() => {
    startingPath.set(path)
    remainingPath.set(path)
  })
}

let historyRouting = false
export const setupHistoryRouting = () => {
  historyRouting = true
  setPath(window.location.pathname)
}

window.addEventListener('click', (e) => {
  if (
    e.target instanceof HTMLAnchorElement &&
    e.target.href.startsWith(window.location.origin)
  ) {
    e.preventDefault()
    if (historyRouting) {
      window.history.pushState({}, '', e.target.href)
    } else {
      window.location.hash = e.target.pathname
    }

    setPath(e.target.pathname)
  }
})
window.addEventListener('popstate', () => {
  setPath(
    historyRouting ? window.location.pathname : window.location.hash.slice(1)
  )
})

export const navigate = (path: string) => {
  if (historyRouting) {
    window.history.pushState({}, '', path)
  } else {
    window.location.hash = path
  }

  setPath(path)
}

/**
 * Define a set of routes.
 *
 * Keys are the whole or part of the path, and values are the component to render.
 *
 * Keys ending in / are treated as a directory, and will match any path that starts with the key.
 * Routes can be nested to create a tree of routes. Nested routes will match off of the remaining path.
 *
 * An empty string will match the index for the route.
 *
 * Parts starting with : are treated as a parameter, and will match any path part. These will be passed
 * to the component as a prop.
 *
 * @param routes
 *
 * @example
 *
 * ```ts
 * const routes = Routes({
 *   '': Home,
 *   'users/': () =>
 *     Routes({
 *       '': UsersList,
 *       ':userId/': ({ userId }) =>
 *         Routes({
 *           '': () => UserDetails({ userId }),
 *           'posts/': () =>
 *            Routes({
 *              '': UserPosts({ userId }),
 *              ':postId': ({ postId }) => PostDetails({ userId, postId }),
 *            }),
 *         }),
 *       }),
 *     })
 *   })
 * ```
 */
export const Routes = <T>(routes: RouteMap<T>) => {
  const route = computed(() => {
    // If the remaining path is the same as the starting path, then we are at the root Routes component
    // and it should react to changes in the starting path.
    const path =
      remainingPath.peek() === startingPath.peek()
        ? startingPath.get()
        : remainingPath.peek()

    let returnVal = nothing
    Object.keys(routes).some((route) => {
      const formattedRoute = `${route.startsWith('/') ? '' : '/'}${route}${
        route.endsWith('/') ? '*?' : ''
      }`
      const pattern = new URLPattern({
        pathname: formattedRoute,
      })
      const match = pattern.exec({ pathname: path })
      if (match) {
        remainingPath.set(`/${match.pathname.groups[0] ?? ''}`)
        returnVal = routes[route](match.pathname.groups)
      }
    })
    return returnVal
  })
  return html`${route}`
}
