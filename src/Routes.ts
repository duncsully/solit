import { HTMLTemplateResult, nothing } from 'lit-html'
import { Signal, signal } from './signals/Signal'
import { computed } from './signals/ComputedSignal'
import { store } from './store'
import { URLPattern } from 'urlpattern-polyfill'
import { createContext } from './context'

// @ts-ignore
globalThis.URLPattern ??= URLPattern

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
  [K in PathParams<T>]: Signal<string>
} & {
  [K in OptionalPathParams<T>]: Signal<string | undefined>
}

type RouteMap<T> = {
  [K in keyof T & string]: T[K] extends (
    props: ParamMap<K>
  ) => HTMLTemplateResult
    ? (props: ParamMap<K>) => HTMLTemplateResult
    : never
}

// TODO better type checking to prevent invalid routes
// TODO Way to load data before returning for SSR?
// TODO types for modifiers * and +
// TODO use computed signals for params

const currentPath = signal(window.location.hash.slice(1))
const setPath = (path: string) => {
  currentPath.set(path)
}

let historyRouting = false
let basePath = ''
export const setupHistoryRouting = ({ base }: { base?: string } = {}) => {
  basePath = base ?? ''
  historyRouting = true
  let initialPath = window.location.pathname
  if (initialPath.startsWith(basePath)) {
    initialPath = initialPath.slice(basePath.length)
  }
  setPath(initialPath)
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
  let fullPath = path
  if (historyRouting) {
    fullPath = basePath + path
    window.history.pushState({}, '', fullPath)
  } else {
    window.location.hash = fullPath
  }

  setPath(fullPath)
}

const isStaticSegment = (segment: string) =>
  !segment.startsWith(':') && segment !== '*'

const compareSegments = (a: string[], b: string[], index = 0) => {
  if (index === a.length) {
    return b.at(-1)!.length - a.at(-1)!.length
  }
  const aSegmentStatic = isStaticSegment(a[index] ?? '')
  const bSegmentStatic = isStaticSegment(b[index] ?? '')

  if (aSegmentStatic === bSegmentStatic) {
    return compareSegments(a, b, index + 1)
  }
  return aSegmentStatic ? -1 : 1
}

const sortPaths = (paths: string[]) =>
  paths.sort((a, b) => {
    const aParts = a.split('/')
    const bParts = b.split('/')
    if (aParts.length !== bParts.length) {
      return bParts.length - aParts.length
    }
    return compareSegments(aParts, bParts)
  })

const remainingPathContext = createContext(currentPath)

/**
 * Router component for choosing a route based on the provided path.
 *
 * First argument is an object of keys representing the path to match, and values representing the component to render.
 *
 * Uses [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API)
 * to handle path matching. Passes the groups from the match to the component as an object
 * of signals.
 *
 * tl;dr:
 * - `''` matches an empty segment (i.e. the index), slash or no slash
 * - `'*'` matches everything (slash required, else '*?' makes the slash optional), passing an object with the key `0` as a signal with the value of the matched path.
 * - `':param'` matches a route segment if present and passes an object with the key `param` as a signal with the value of the matched param.
 * - `':param?'` matches a route segment, present or not, and passes an object with the key `param` as a signal with the value of the matched param, or undefined if not present.
 *
 * The second argument defaults to the current remaining path context signal used by the router navigation functions. You can optionally
 * pass a different signal, e.g. selected tab state, to match against.
 *
 * @example
 *
 * ```ts
 * Router({
 *   '': Home,
 *   'user/*?': () =>
 *     Router({
 *       '': UsersList,
 *       ':id': ({ id }) => UserDetail(id),
 *       'me': MyProfile,
 *     }),
 *  'about': About,
 *  '*': NotFound,
 * })
 * ```
 *
 * @param routes An object of keys representing the path to match, and values representing the component to render.
 * @param path The path to match against.
 * @returns The component whose path matches the provided path.
 */
export const Router = <K, T extends RouteMap<K>>(
  routes: T,
  path = remainingPathContext.value
) => {
  const params = store({} as any)

  const activePath = computed(() => {
    const formattedPath = `${path.get()?.startsWith('/') ? '' : '/'}${
      path.get() ?? ''
    }`

    const matchedPath = sortPaths(Object.keys(routes)).find((route) => {
      const formattedRoute = `${route.startsWith('/') ? '' : '/'}${route}`
      const pattern = new URLPattern({
        pathname: formattedRoute,
      })
      const match = pattern.exec({ pathname: formattedPath })
      if (match) {
        // TODO: side effect here, move out somehow?
        // This allows for a change in route that doesn't change the component, but still updates the params
        Object.entries(match.pathname.groups).forEach(([key, value]) => {
          params[key] = value
        })
        return formattedRoute
      }
    }) as keyof T | undefined

    return matchedPath
  })

  return computed(() =>
    remainingPathContext.provide(
      params.$[0],
      () => routes[activePath.get() ?? '']?.(params.$) ?? nothing
    )
  )
}
