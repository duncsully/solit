import { batch, Computed, computed, state, watch, Writable } from './state'
import { describe, it, expect, vi } from 'vitest'

describe('Computed', () => {
  describe('get', () => {
    it('returns return value of function passed to constructor', () => {
      const computedObservable = new Computed(() => 'hi')

      expect(computedObservable.get()).toBe('hi')
    })
  })

  describe('reactivity', () => {
    it('calls subscribers when dependencies change', () => {
      const number = new Writable(1)
      const squared = new Computed(() => number.get() ** 2)
      const cubed = new Computed(() => number.get() ** 3)

      const subscriber = vi.fn()
      squared.observe(subscriber)
      cubed.observe(subscriber)
      number.set(2)

      expect(subscriber).toHaveBeenCalledTimes(2)
      expect(subscriber).toHaveBeenNthCalledWith(1, 4)
      expect(subscriber).toHaveBeenNthCalledWith(2, 8)
    })

    it('does not recompute data until dependencies change (i.e. is memoized)', () => {
      const array = new Writable(['a', 'b', 'c'])
      const getterCheck = vi.fn()
      const sorted = new Computed(() => {
        getterCheck()
        return [...array.get()].sort()
      })

      sorted.subscribe(vi.fn())
      getterCheck.mockClear()

      sorted.get()

      expect(getterCheck).not.toHaveBeenCalled()

      array.set([])

      expect(getterCheck).toHaveBeenCalled()
    })

    it('does not update if recomputed value still the same after dependencies change', () => {
      const float = new Writable(1.1)
      const floored = new Computed(() => Math.floor(float.get()))
      const doubledFloored = new Computed(() => floored.get() * 2)

      const flooredSubscriber = vi.fn()
      floored.subscribe(flooredSubscriber)
      const doubledFlooredSubscriber = vi.fn()
      doubledFloored.subscribe(doubledFlooredSubscriber)
      flooredSubscriber.mockClear()
      doubledFlooredSubscriber.mockClear()
      float.set(1.2)

      expect(flooredSubscriber).not.toHaveBeenCalled()
      expect(doubledFlooredSubscriber).not.toHaveBeenCalled()
    })

    it('lazily evaluates getters', () => {
      const array = new Writable(['a', 'b', 'c'])
      const getterCheck = vi.fn()
      const sorted = new Computed(() => {
        getterCheck()
        return [...array.get()].sort()
      })
      getterCheck.mockClear()

      array.set([])

      expect(getterCheck).not.toHaveBeenCalled()

      sorted.get()

      expect(getterCheck).toHaveBeenCalled()

      getterCheck.mockClear()

      array.set(['hi'])

      expect(getterCheck).not.toHaveBeenCalled()

      sorted.subscribe(vi.fn())

      expect(getterCheck).toHaveBeenCalled()
    })

    it(`works with getters that do not call all dependencies (i.e. conditionals) even 
    if subscribing after conditional would expose new dependencies`, () => {
      const number = new Writable(1)
      const laterNumber = new Writable(2)
      const conditionalComputed = new Computed(() => {
        if (number.get() > 2) {
          return laterNumber.get()
        }
        return 0
      })

      number.set(3)
      const subscriber = vi.fn()
      conditionalComputed.observe(subscriber)
      laterNumber.set(5)

      expect(subscriber).toHaveBeenCalled()
    })
  })
})

describe('Writable', () => {
  describe('get', () => {
    it('returns the primitive value passed to the constructor', () => {
      const number = new Writable(1)

      expect(number.get()).toBe(1)
    })
  })

  describe('peak', () => {
    it('returns the primitive value passed to the constructor and does not update dependent Computeds', () => {
      const number = new Writable(1)

      expect(number.peak()).toBe(1)

      const squared = new Computed(() => number.peak() ** 2)
      squared.get()
      number.set(2)

      expect(squared.get()).toBe(1)
    })
  })

  describe('set', () => {
    it('sets a new primitive value', () => {
      const number = new Writable(1)

      number.set(2)

      expect(number.get()).toBe(2)
    })
  })

  describe('update', () => {
    it('sets a new primitive value returned by passed function', () => {
      const nubbin = new Writable(1)

      nubbin.update((value) => ++value)

      expect(nubbin.get()).toBe(2)
    })
  })

  describe('observe + set', () => {
    it('calls all callbacks provided to subscribe method if value changed', () => {
      const number = new Writable(1)

      const subscriber1 = vi.fn()
      number.observe(subscriber1)
      const subscriber2 = vi.fn()
      number.observe(subscriber2)
      number.set(2)

      expect(subscriber1).toHaveBeenCalledWith(2)
      expect(subscriber2).toHaveBeenCalledWith(2)
    })

    it('does not call all callbacks if value did not change (using default hasChanged)', () => {
      const number = new Writable(1)

      const subscriber = vi.fn()
      number.observe(subscriber)
      number.set(1)

      expect(subscriber).not.toHaveBeenCalled()
    })

    it('can have change check configured with hasChanged option', () => {
      const list = new Writable(['beans', 'chicken'], {
        hasChanged: (current, next) =>
          next.some((value, i) => current?.[i] !== value),
      })

      const subscriber = vi.fn()
      list.observe(subscriber)
      list.set(['beans', 'chicken'])

      expect(subscriber).not.toHaveBeenCalled()
    })
  })

  describe('unsubscribe', () => {
    it('removes passed callback from subscriptions', () => {
      const number = new Writable(1)

      const subscriber = vi.fn()
      number.observe(subscriber)
      number.unsubscribe(subscriber)
      number.set(2)

      expect(subscriber).not.toHaveBeenCalled()
    })

    it('is also returned by observe method', () => {
      const number = new Writable(1)

      const subscriber = vi.fn()
      const unsubscribe = number.observe(subscriber)
      unsubscribe()
      number.set(2)

      expect(subscriber).not.toHaveBeenCalled()
    })
  })

  describe('subscribe', () => {
    it('calls subscriber immediately with current value', () => {
      const number = new Writable(1)
      const subscriber1 = vi.fn()

      number.subscribe(subscriber1)

      expect(subscriber1).toHaveBeenCalledWith(1)

      number.set(2)
      const subscriber2 = vi.fn()
      number.subscribe(subscriber2)

      expect(subscriber2).toHaveBeenCalledWith(2)
    })
  })

  describe('batch', () => {
    it('defers subscription updates until after all actions (nested included) finish', () => {
      const number = new Writable(1)
      const string = new Writable('hi')
      const subscriber = vi.fn()
      number.observe(subscriber)
      string.observe(subscriber)

      Computed.batch(() => {
        Computed.batch(() => {
          number.set(2)
          expect(subscriber).not.toHaveBeenCalled()
        })
        expect(subscriber).not.toHaveBeenCalled()
        string.set('yo')
      })

      expect(subscriber).toHaveBeenCalledTimes(2)
    })

    it('does not recompute Computeds if dependencies not updated', () => {
      const width = new Writable(1)
      const length = new Writable(10)
      const getterCheck = vi.fn(() => width.get() * length.get())
      const area = new Computed(getterCheck)
      area.get()
      getterCheck.mockClear()

      batch(() => {
        width.set(1)
        length.set(10)
      })

      area.get()

      expect(getterCheck).not.toHaveBeenCalled()
    })

    it("will not update dependents' subscribers if its value after all operations has not changed", () => {
      const width = new Writable(1)
      const height = new Writable(10)
      const area = new Computed(() => width.get() * height.get())
      const subscriber = vi.fn()
      area.subscribe(subscriber)
      subscriber.mockClear()

      Computed.batch(() => {
        width.set(2)
        height.set(5)
      })

      expect(subscriber).not.toHaveBeenCalled()
    })

    it('works if Computed dependent is read during the same action any of its dependencies are updated in', () => {
      const width = new Writable(1, { name: 'width' })
      const length = new Writable(10, { name: 'length' })
      const area = new Computed(() => width.get() * length.get(), {
        name: 'area',
      })
      const perimeter = new Computed(() => width.get() * 2 + length.get() * 2, {
        name: 'perimeter',
      })
      const height = new Writable(2, { name: 'height' })
      const getterCheck = vi.fn(() => area.get() * height.get())
      const volume = new Computed(getterCheck, { name: 'volume' })
      volume.subscribe(vi.fn())
      getterCheck.mockClear()
      const perimeterSubscriber = vi.fn()
      perimeter.subscribe(perimeterSubscriber)
      perimeterSubscriber.mockClear()

      batch(() => {
        width.set(2)
        // Should not be recomputed yet
        expect(getterCheck).not.toHaveBeenCalled()
        // Lazily recomputed
        expect(volume.get()).toBe(40)
        getterCheck.mockClear()
        volume.get()
        // No need to recompute
        expect(getterCheck).not.toHaveBeenCalled()
        length.set(9)
      })

      expect(perimeterSubscriber).not.toHaveBeenCalled()
    })
  })
})

describe('state', () => {
  it('returns a Writable instance', () => {
    const someState = state(1)
    expect(someState instanceof Writable).toBeTruthy()
  })
})

describe('computed', () => {
  it('returns a Computed instance', () => {
    const someComputed = computed(() => 2 * 2)

    expect(someComputed instanceof Computed).toBeTruthy()
  })
})

describe('watch', () => {
  it('runs the callback immediately', () => {
    const number = state(1)
    const squared = computed(() => number.get() ** 2)
    const effectFn = vi.fn(() => {
      squared.get()
    })
    watch(effectFn)

    expect(effectFn).toHaveBeenCalled()
  })

  it('runs the callback when any of its dependencies change', () => {
    const number = state(1)
    const squared = computed(() => number.get() ** 2)
    const effectFn = vi.fn(() => {
      squared.get()
    })
    watch(effectFn, 'test watcher')
    effectFn.mockReset()

    number.set(2)

    expect(effectFn).toHaveBeenCalled()
  })
})
