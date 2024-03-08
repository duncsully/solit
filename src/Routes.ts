import { nothing } from 'lit'
import { Component } from './component'
import { html } from './html'
import { batch, computed, state } from './Observable'

// type for extracting params from path
type PathParams<T extends string | number | symbol> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | PathParams<Rest>
    : T extends `${string}:${infer Param}`
    ? Param
    : never

type ParamMap<T extends string> = {
  [K in PathParams<T>]: string
}

type RouteMap<T> = {
  [K in keyof T & string]: T[K] extends Component<[ParamMap<K>]>
    ? Component<[ParamMap<K>]>
    : never
}

// TODO better type checking to prevent invalid routes
// TODO Way to load data before returning for SSR?
// TODO hash routing option
// TODO * parts
// TODO test route priority

const startingPath = state(window.location.pathname)
const remainingPath = state(window.location.pathname)
const setPath = (path: string) => {
  batch(() => {
    startingPath.set(path)
    remainingPath.set(path)
  })
}

window.addEventListener('popstate', () => {
  setPath(window.location.pathname)
})

window.addEventListener('click', (e) => {
  if (
    e.target instanceof HTMLAnchorElement &&
    e.target.href.startsWith(window.location.origin)
  ) {
    e.preventDefault()
    window.history.pushState({}, '', e.target.href)
    setPath(e.target.pathname)
  }
})

export const navigate = (path: string) => {
  window.history.pushState({}, '', path)
  setPath(path)
}

/**
 * Define a set of routes.
 *
 * Keys are a part of the path, and values are the component to render.
 *
 * Parts ending in / are treated as a directory, and will match any path that starts with the part.
 * Routes can be nested to create a tree of routes. Nested routes will match off of the remaining path.
 *
 * And empty string will match the index for the route.
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
      const paramExtractingRegex = new RegExp(
        `^\/?${route.replace(/:(\w+)/g, '(?<$1>\\w+)')}${
          route.endsWith('/') ? '?(.*)' : '$'
        }`
      )
      const match = path.match(paramExtractingRegex)
      if (match) {
        remainingPath.set(match.at(-1)!)
        returnVal = routes[route](match.groups)
      }
    })
    return returnVal
  })
  return html`${route}`
}
