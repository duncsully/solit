import { describe, expect, it, vi } from 'vitest'
import { store } from './store'
import { computed, state, watch } from './Observable'

describe('store', () => {
  it('allows reading properties', () => {
    const dimensions = store({ width: 1, height: 2 })
    expect(dimensions.width).toBe(1)
    expect(dimensions.height).toBe(2)
  })

  it('allows reading getters', () => {
    const dimensions = store({
      width: 1,
      height: 2,
      get area() {
        return this.width * this.height
      },
    })
    expect(dimensions.area).toBe(2)
  })

  it('allows writing properties', () => {
    const dimensions = store({ width: 1, height: 2 })
    dimensions.width = 3
    expect(dimensions.width).toBe(3)
  })

  it('works for nested objects', () => {
    const test = store({
      nested: {
        value: 1,
      },
    })

    expect(test.nested.value).toBe(1)

    test.nested.value = 2

    expect(test.nested.value).toBe(2)
  })

  it('sets reads as dependencies', () => {
    const test = store({
      value: 1,
    })
    const subscriber = vi.fn()
    watch(() => {
      subscriber(test.value)
    })
    subscriber.mockClear()

    test.value = 2

    expect(subscriber).toHaveBeenCalledWith(2)
  })

  it('tracks getter dependencies as well', () => {
    const test = store({
      value: 1,
      get doubled() {
        return this.value * 2
      },
    })
    const subscriber = vi.fn()
    watch(() => {
      subscriber(test.doubled)
    })
    subscriber.mockClear()

    test.value = 2

    expect(subscriber).toHaveBeenCalledWith(4)
  })

  it('tracks nested dependencies', () => {
    const test = store({
      nested: {
        value: 1,
      },
    })
    const subscriber = vi.fn()
    watch(() => {
      subscriber(test.nested.value)
    })
    subscriber.mockClear()

    test.nested = { value: 2 }

    expect(subscriber).toHaveBeenCalledWith(2)

    test.nested.value = 3

    expect(subscriber).toHaveBeenCalledWith(3)
  })

  it('works with signals', () => {
    const count = state(0)
    const test = store({
      name: 'alfred',
      get doubled() {
        return count.get() * 2
      },
    })
    const uppered = computed(() => test.name.toUpperCase())
    const subscriber = vi.fn()
    watch(() => {
      subscriber(test.doubled)
    })
    subscriber.mockClear()

    count.set(1)

    expect(subscriber).toHaveBeenCalledWith(2)
    expect(test.doubled).toBe(2)

    subscriber.mockClear()

    watch(() => {
      subscriber(uppered.get())
    })
    subscriber.mockClear()

    test.name = 'bob'

    expect(subscriber).toHaveBeenCalledWith('BOB')
    expect(uppered.get()).toBe('BOB')
  })
})
