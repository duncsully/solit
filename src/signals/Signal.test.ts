import { computed, ComputedSignal } from './ComputedSignal'
import { batch, signal, Signal } from './Signal'
import { describe, it, expect, vi } from 'vitest'

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

      const squared = new ComputedSignal(() => number.peek ** 2)
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
    const area = new ComputedSignal(getterCheck)
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
    const area = new ComputedSignal(() => width.get() * height.get())
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
    const area = new ComputedSignal(() => width.get() * length.get(), {
      name: 'area',
    })
    const perimeter = new ComputedSignal(
      () => width.get() * 2 + length.get() * 2,
      {
        name: 'perimeter',
      }
    )
    const height = new Signal(2, { name: 'height' })
    const getterCheck = vi.fn(() => area.get() * height.get())
    const volume = new ComputedSignal(getterCheck, { name: 'volume' })
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
