import { batch, Computed, computed, signal, watch, Signal } from './Signal'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

describe('Computed', () => {
  describe('constructor', () => {
    describe('cacheSize', () => {
      it('caches previous results up to provided cacheSize value', () => {
        const number = new Signal(1)
        const getter = vi.fn(() => number.get() * 2)
        const doubled = new Computed(getter, { cacheSize: 2 })
        // Cache with number = 1
        doubled.get()
        number.set(2)
        // Cache with number = 2
        doubled.get()
        getter.mockClear()

        number.set(1)

        // Should load from cache
        expect(doubled.get()).toBe(2)
        expect(getter).not.toHaveBeenCalled()

        number.set(2)

        // Should load from cache
        expect(doubled.get()).toBe(4)
        expect(getter).not.toHaveBeenCalled()

        // Should not load from cache
        number.set(3)
        expect(doubled.get()).toBe(6)
        expect(getter).toHaveBeenCalled()
        getter.mockClear()

        // Should no longer be in cache
        number.set(1)
        expect(doubled.get()).toBe(2)
        expect(getter).toHaveBeenCalled()
        getter.mockClear()

        // Should still be in cache
        number.set(3)
        expect(doubled.get()).toBe(6)
        expect(getter).not.toHaveBeenCalled()
      })

      it('moves cache hits to the front of the cache', () => {
        const number = new Signal(1)
        const getter = vi.fn(() => number.get() * 2)
        const doubled = new Computed(getter, { cacheSize: 3 })
        doubled.subscribe(vi.fn())
        number.set(2)
        number.set(3)
        // Cache should now be filled

        number.set(1) // Cache hit, move to the front

        // Load two new values, remove two oldest
        number.set(4)
        number.set(5)

        getter.mockClear()

        // Should load from cache
        number.set(1)
        expect(doubled.get()).toBe(2)
        expect(getter).not.toHaveBeenCalled()

        // Should have been removed from cache
        number.set(2)
        expect(doubled.get()).toBe(4)
        expect(getter).toHaveBeenCalled()
      })

      it('prevents memoization when set to 0', () => {
        const number = new Signal(1)
        const getter = vi.fn(() => number.get() * 2)
        const doubled = new Computed(getter, { cacheSize: 0 })
        doubled.get()
        doubled.get()
        doubled.get()

        expect(getter).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('API', () => {
    describe('value', () => {
      it('getter returns return value of function passed to constructor', () => {
        const computedObservable = new Computed(() => 'hi')

        expect(computedObservable.value).toBe('hi')
      })
    })

    describe('get', () => {
      it('returns return value of function passed to constructor', () => {
        const computedObservable = new Computed(() => 'hi')

        expect(computedObservable.get()).toBe('hi')
      })
    })

    describe('peek', () => {
      it('returns return value of function passed to constructor and does not update dependent Computeds', () => {
        const number = new Signal(2)
        const doubled = new Computed(() => number.get() * 2)
        const quadrupledOnce = new Computed(() => doubled.peek * 2)
        quadrupledOnce.get()

        number.set(3)

        expect(quadrupledOnce.get()).toBe(8)
      })
    })

    describe('observe', () => {
      it('calls all callbacks provided if value changes', () => {
        const number = new Signal(1)
        const doubled = new Computed(() => number.get() * 2)
        const subscriber1 = vi.fn()
        doubled.observe(subscriber1)
        const subscriber2 = vi.fn()
        doubled.observe(subscriber2)

        number.set(2)

        expect(subscriber1).toHaveBeenCalledWith(4)
        expect(subscriber2).toHaveBeenCalledWith(4)
      })

      it("calls nested computed subscribers if a dependent's dependencies change", () => {
        const number = new Signal(1)
        const doubled = new Computed(() => number.get() * 2)
        const quadrupled = new Computed(() => doubled.get() * 2)
        const subscriber = vi.fn()
        quadrupled.observe(subscriber)

        number.set(2)

        expect(subscriber).toHaveBeenCalledWith(8)

        number.set(3)

        expect(subscriber).toHaveBeenCalledWith(12)
      })

      it('does not call callback immediately', () => {
        const number = new Signal(1)
        const doubled = new Computed(() => number.get() * 2)
        const subscriber = vi.fn()
        doubled.observe(subscriber)

        expect(subscriber).not.toHaveBeenCalled()
      })

      it('returns a function that unsubscribes the passed callback', () => {
        const number = new Signal(1)
        const doubled = new Computed(() => number.get() * 2)
        const subscriber = vi.fn()
        const unsubscribe = doubled.observe(subscriber)
        doubled.observe(vi.fn())
        unsubscribe()

        number.set(2)

        expect(subscriber).not.toHaveBeenCalled()
      })
    })

    describe('subscribe', () => {
      it('calls all callbacks provided if value changes', () => {
        const number = new Signal(1)
        const doubled = new Computed(() => number.get() * 2)
        const subscriber1 = vi.fn()
        doubled.subscribe(subscriber1)
        const subscriber2 = vi.fn()
        doubled.subscribe(subscriber2)

        number.set(2)

        expect(subscriber1).toHaveBeenCalledWith(4)
        expect(subscriber2).toHaveBeenCalledWith(4)
      })

      it('calls callback immediately with current value', () => {
        const number = new Signal(1)
        const doubled = new Computed(() => number.get() * 2)
        const subscriber = vi.fn()
        doubled.subscribe(subscriber)

        expect(subscriber).toHaveBeenCalledWith(2)
      })

      it('returns a function that unsubscribes the passed callback', () => {
        const number = new Signal(1)
        const doubled = new Computed(() => number.get() * 2)
        const subscriber = vi.fn()
        const unsubscribe = doubled.subscribe(subscriber)
        subscriber.mockClear()
        doubled.subscribe(vi.fn())
        unsubscribe()

        number.set(2)

        expect(subscriber).not.toHaveBeenCalled()
      })
    })

    describe('unsubscribe', () => {
      it('removes passed callback from subscriptions', () => {
        const number = new Signal(1)
        const doubled = new Computed(() => number.get() * 2)
        const subscriber = vi.fn()
        doubled.observe(subscriber)
        doubled.unsubscribe(subscriber)
        number.set(2)

        expect(subscriber).not.toHaveBeenCalled()
      })
    })

    describe('toJson', () => {
      it('return the value of the computed signal', () => {
        const number = new Signal(1)
        const doubled = new Computed(() => number.get() * 2)

        expect(JSON.stringify(doubled)).toBe('2')
      })
    })
  })

  // Not important to the API contract, but important for behavior, e.g. performance
  describe('implementation details', () => {
    it('calls subscribers when dependencies change', () => {
      const number = new Signal(1)
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
      const array = new Signal(['a', 'b', 'c'])
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

    it('does not recompute if dependencies have not changed between losing and gaining subscription', () => {
      const count = new Signal(1)
      const getterCheck = vi.fn(() => count.value)
      const doubled = new Computed(() => getterCheck() * 2)
      const unsub = doubled.subscribe(vi.fn())
      unsub()

      getterCheck.mockClear()

      doubled.subscribe(vi.fn())

      expect(getterCheck).not.toHaveBeenCalled()
    })

    it('subscribes to cached dependencies when getting a cache hit', () => {
      const checkSecond = new Signal(true)
      const num = new Signal(1)
      const comp = new Computed(
        () => {
          if (checkSecond.value) return num.value * 2
          return 0
        },
        { cacheSize: 2 }
      )

      const subscriber = vi.fn()
      comp.subscribe(subscriber) // computed, added to cache: true, 1 => 2

      checkSecond.set(false) // computed, added to cache: false => 0
      checkSecond.set(true) // retrieved from cache: true, 1 => 2

      num.set(2) // Not in cache, but are we subscribed to this dependency?

      expect(subscriber).toHaveBeenCalledWith(4)
    })

    it('tracks dependencies again after losing and regaining subscription', () => {
      const count = new Signal(1)
      const getterCheck = vi.fn(() => count.value)
      const doubled = new Computed(() => getterCheck() * 2)
      const unsub = doubled.subscribe(vi.fn())
      unsub()

      getterCheck.mockClear()

      doubled.subscribe(vi.fn())
      count.set(3)

      expect(getterCheck).toHaveBeenCalled()
    })

    it('does not update if recomputed value still the same after dependencies change', () => {
      const float = new Signal(1.1)
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
      const array = new Signal(['a', 'b', 'c'])
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
      const number = new Signal(1)
      const laterNumber = new Signal(2)
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

    it('stops tracking dependencies that were not called in previous computation', () => {
      const firstNumber = new Signal(1)
      const secondNumber = new Signal(2)
      const lever = new Signal(true)
      const computation = vi.fn(() => {
        if (lever.get()) {
          return firstNumber.get()
        }
        return secondNumber.get()
      })
      const computed = new Computed(computation)

      const subscriber = vi.fn()
      computed.subscribe(subscriber)
      lever.set(false)
      computation.mockClear()
      firstNumber.set(2)

      expect(computation).not.toHaveBeenCalled()
    })
  })
})

describe('Signal', () => {
  describe('value', () => {
    it('getter returns primitive value passed to the constructor', () => {
      const number = new Signal(1)

      expect(number.value).toBe(1)
    })

    it('setter sets a new primitive value', () => {
      const number = new Signal(1)

      number.value = 2

      expect(number.value).toBe(2)
    })
  })

  describe('get', () => {
    it('returns the primitive value passed to the constructor', () => {
      const number = new Signal(1)

      expect(number.get()).toBe(1)
    })
  })

  describe('peek', () => {
    it('returns the primitive value passed to the constructor and does not update dependent Computeds', () => {
      const number = new Signal(1)

      expect(number.peek).toBe(1)

      const squared = new Computed(() => number.peek ** 2)
      squared.get()
      number.set(2)

      expect(squared.get()).toBe(1)
    })
  })

  describe('set', () => {
    it('sets a new primitive value', () => {
      const number = new Signal(1)

      number.set(2)

      expect(number.get()).toBe(2)
    })
  })

  describe('update', () => {
    it('sets a new primitive value returned by passed function', () => {
      const nubbin = new Signal(1)

      nubbin.update((value) => ++value)

      expect(nubbin.get()).toBe(2)
    })
  })

  describe('observe + set', () => {
    it('calls all callbacks provided to subscribe method if value changed', () => {
      const number = new Signal(1)

      const subscriber1 = vi.fn()
      number.observe(subscriber1)
      const subscriber2 = vi.fn()
      number.observe(subscriber2)
      number.set(2)

      expect(subscriber1).toHaveBeenCalledWith(2)
      expect(subscriber2).toHaveBeenCalledWith(2)
    })

    it('does not call all callbacks if value did not change (using default hasChanged)', () => {
      const number = new Signal(1)

      const subscriber = vi.fn()
      number.observe(subscriber)
      number.set(1)

      expect(subscriber).not.toHaveBeenCalled()
    })

    it('can have change check configured with hasChanged option', () => {
      const list = new Signal(['beans', 'chicken'], {
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
      const number = new Signal(1)

      const subscriber = vi.fn()
      number.observe(subscriber)
      number.unsubscribe(subscriber)
      number.set(2)

      expect(subscriber).not.toHaveBeenCalled()
    })

    it('is also returned by observe method', () => {
      const number = new Signal(1)

      const subscriber = vi.fn()
      const unsubscribe = number.observe(subscriber)
      unsubscribe()
      number.set(2)

      expect(subscriber).not.toHaveBeenCalled()
    })
  })

  describe('subscribe', () => {
    it('calls subscriber immediately with current value', () => {
      const number = new Signal(1)
      const subscriber1 = vi.fn()

      number.subscribe(subscriber1)

      expect(subscriber1).toHaveBeenCalledWith(1)

      number.set(2)
      const subscriber2 = vi.fn()
      number.subscribe(subscriber2)

      expect(subscriber2).toHaveBeenCalledWith(2)
    })
  })
})

describe('batch', () => {
  it('defers subscription updates until after all actions (nested included) finish', () => {
    const number = new Signal(1)
    const string = new Signal('hi')
    const subscriber = vi.fn()
    number.observe(subscriber)
    string.observe(subscriber)

    batch(() => {
      batch(() => {
        number.set(2)
        expect(subscriber).not.toHaveBeenCalled()
      })
      expect(subscriber).not.toHaveBeenCalled()
      string.set('yo')
    })

    expect(subscriber).toHaveBeenCalledTimes(2)
  })

  it('does not recompute Computeds if dependencies not updated', () => {
    const width = new Signal(1)
    const length = new Signal(10)
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

  it('will not update writable subscribers if its value after all operations has not changed', () => {
    const number = new Signal(1)
    const subscriber = vi.fn()
    number.observe(subscriber)

    batch(() => {
      number.set(2)
      number.set(3)
      number.set(1)
    })

    expect(subscriber).not.toHaveBeenCalled()
  })

  it("will not update dependents' subscribers if its value after all operations has not changed", () => {
    const width = new Signal(1)
    const height = new Signal(10)
    const area = new Computed(() => width.get() * height.get())
    const subscriber = vi.fn()
    area.subscribe(subscriber)
    subscriber.mockClear()

    batch(() => {
      width.set(2)
      height.set(5)
    })

    expect(subscriber).not.toHaveBeenCalled()
  })

  it('works if Computed dependent is read during the same action any of its dependencies are updated in', () => {
    const width = new Signal(1, { name: 'width' })
    const length = new Signal(10, { name: 'length' })
    const area = new Computed(() => width.get() * length.get(), {
      name: 'area',
    })
    const perimeter = new Computed(() => width.get() * 2 + length.get() * 2, {
      name: 'perimeter',
    })
    const height = new Signal(2, { name: 'height' })
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

  it('returns the return value of the passed function', () => {
    const returnValue = batch(() => 5)

    expect(returnValue).toBe(5)
  })
})

describe('signal', () => {
  it('returns a Writable instance', () => {
    const someState = signal(1)
    expect(someState instanceof Signal).toBeTruthy()
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
    const number = signal(1)
    const squared = computed(() => number.get() ** 2)
    const effectFn = vi.fn(() => {
      squared.get()
    })
    watch(effectFn)

    expect(effectFn).toHaveBeenCalled()
  })

  it('runs the callback when any of its dependencies change', () => {
    const number = signal(1)
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
