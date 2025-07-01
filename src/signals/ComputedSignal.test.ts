import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { Signal } from './Signal'
import { computed, ComputedSignal } from './ComputedSignal'

describe('Computed', () => {
  describe('constructor', () => {
    describe('cacheSize', () => {
      it('caches previous results up to provided cacheSize value', () => {
        const number = new Signal(1)
        const getter = vi.fn(() => number.get() * 2)
        const doubled = new ComputedSignal(getter, { cacheSize: 2 })
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
        const doubled = new ComputedSignal(getter, { cacheSize: 3 })
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
        const doubled = new ComputedSignal(getter, { cacheSize: 0 })
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
        const computedObservable = new ComputedSignal(() => 'hi')

        expect(computedObservable.value).toBe('hi')
      })
    })

    describe('get', () => {
      it('returns return value of function passed to constructor', () => {
        const computedObservable = new ComputedSignal(() => 'hi')

        expect(computedObservable.get()).toBe('hi')
      })
    })

    describe('peek', () => {
      it('returns return value of function passed to constructor and does not update dependent Computeds', () => {
        const number = new Signal(2)
        const doubled = new ComputedSignal(() => number.get() * 2)
        const quadrupledOnce = new ComputedSignal(() => doubled.peek * 2)
        quadrupledOnce.get()

        number.set(3)

        expect(quadrupledOnce.get()).toBe(8)
      })
    })

    describe('observe', () => {
      it('calls all callbacks provided if value changes', () => {
        const number = new Signal(1)
        const doubled = new ComputedSignal(() => number.get() * 2)
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
        const doubled = new ComputedSignal(() => number.get() * 2)
        const quadrupled = new ComputedSignal(() => doubled.get() * 2)
        const subscriber = vi.fn()
        quadrupled.observe(subscriber)

        number.set(2)

        expect(subscriber).toHaveBeenCalledWith(8)

        number.set(3)

        expect(subscriber).toHaveBeenCalledWith(12)
      })

      it('does not call callback immediately', () => {
        const number = new Signal(1)
        const doubled = new ComputedSignal(() => number.get() * 2)
        const subscriber = vi.fn()
        doubled.observe(subscriber)

        expect(subscriber).not.toHaveBeenCalled()
      })

      it('returns a function that unsubscribes the passed callback', () => {
        const number = new Signal(1)
        const doubled = new ComputedSignal(() => number.get() * 2)
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
        const doubled = new ComputedSignal(() => number.get() * 2)
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
        const doubled = new ComputedSignal(() => number.get() * 2)
        const subscriber = vi.fn()
        doubled.subscribe(subscriber)

        expect(subscriber).toHaveBeenCalledWith(2)
      })

      it('returns a function that unsubscribes the passed callback', () => {
        const number = new Signal(1)
        const doubled = new ComputedSignal(() => number.get() * 2)
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
        const doubled = new ComputedSignal(() => number.get() * 2)
        const subscriber = vi.fn()
        doubled.observe(subscriber)
        doubled.unsubscribe(subscriber)
        number.set(2)

        expect(subscriber).not.toHaveBeenCalled()
      })
    })

    describe('toJson', () => {
      it('returns the value of the computed signal', () => {
        const number = new Signal(1)
        const doubled = new ComputedSignal(() => number.get() * 2)

        expect(JSON.stringify(doubled)).toBe('2')
      })
    })
  })

  // Not important to the API contract, but important for behavior, e.g. performance
  describe('implementation details', () => {
    it('calls subscribers when dependencies change', () => {
      const number = new Signal(1)
      const squared = new ComputedSignal(() => number.get() ** 2)
      const cubed = new ComputedSignal(() => number.get() ** 3)

      const squaredSubscriber = vi.fn()
      squared.observe(squaredSubscriber)
      const cubedSubscriber = vi.fn()
      cubed.observe(cubedSubscriber)
      number.set(2)

      expect(squaredSubscriber).toHaveBeenCalledWith(4)
      expect(cubedSubscriber).toHaveBeenCalledWith(8)
    })

    it('does not recompute data until dependencies change (i.e. is memoized)', () => {
      const array = new Signal(['a', 'b', 'c'])
      const getterCheck = vi.fn()
      const sorted = new ComputedSignal(() => {
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
      const doubled = new ComputedSignal(() => getterCheck() * 2)
      const unsub = doubled.subscribe(vi.fn())
      unsub()

      getterCheck.mockClear()

      doubled.subscribe(vi.fn())

      expect(getterCheck).not.toHaveBeenCalled()
    })

    it('subscribes to cached dependencies when getting a cache hit', () => {
      const checkSecond = new Signal(true)
      const num = new Signal(1)
      const comp = new ComputedSignal(
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
      const doubled = new ComputedSignal(() => getterCheck() * 2)
      const unsub = doubled.subscribe(vi.fn())
      unsub()

      getterCheck.mockClear()

      doubled.subscribe(vi.fn())
      count.set(3)

      expect(getterCheck).toHaveBeenCalled()
    })

    it('does not update if recomputed value still the same after dependencies change', () => {
      const float = new Signal(1.1)
      const floored = new ComputedSignal(() => Math.floor(float.get()))
      const doubledFloored = new ComputedSignal(() => floored.get() * 2)

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
      const sorted = new ComputedSignal(() => {
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
      const conditionalComputed = new ComputedSignal(() => {
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
      const computed = new ComputedSignal(computation)

      const subscriber = vi.fn()
      computed.subscribe(subscriber)
      lever.set(false)
      computation.mockClear()
      firstNumber.set(2)

      expect(computation).not.toHaveBeenCalled()
    })
  })
})

describe('computed', () => {
  it('returns a Computed instance', () => {
    const someComputed = computed(() => 2 * 2)

    expect(someComputed instanceof ComputedSignal).toBeTruthy()
  })
})
