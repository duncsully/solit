import { describe, expect, it, vi } from 'vitest'
import { store } from './store'
import { computed, signal, watch } from './Signal'

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
    const count = signal(0)
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

  it('batches updates from methods', () => {
    const test = store({
      width: 1,
      height: 2,
      get area() {
        return this.width * this.height
      },
      flip() {
        ;[this.width, this.height] = [this.height, this.width]
      },
    })
    const subscriber = vi.fn()
    watch(() => {
      subscriber(test.area)
    })
    subscriber.mockClear()

    test.flip()

    expect(subscriber).not.toHaveBeenCalled()
  })

  it('accepts new keys', () => {
    const test = store<{ value: number; later?: string }>({ value: 1 })
    const subscriber = vi.fn()
    watch(() => {
      subscriber(test?.later)
    })
    subscriber.mockClear()

    test.later = 'hello'

    expect(subscriber).toHaveBeenCalled()
  })

  it('binds this to parent proxy', () => {
    const test = store({
      nested: {
        value: 1,
        get doubled() {
          return this.value * 2
        },
      },
    })

    expect(test.nested.doubled).toBe(2)
  })

  it('works with arrow functions', () => {
    const test = store({
      value: 1,
      doubled: () => {
        return test.value * 2
      },
    })

    expect(test.doubled()).toBe(2)
  })

  it('allows setting new methods', () => {
    const test = store({
      value: 1,
      changeValue() {
        this.value = 2
      },
    })
    const subscriber = vi.fn()
    watch(() => {
      subscriber(test.changeValue)
    })
    subscriber.mockClear()

    test.changeValue = () => {
      test.value = 3
    }

    expect(subscriber).toHaveBeenCalled()

    test.changeValue()

    expect(test.value).toBe(3)
  })

  it('allows setting new getters', () => {
    const test = store({
      obj: {
        get value() {
          return 1
        },
      },
    })
    const subscriber = vi.fn()
    watch(() => {
      subscriber(test.obj.value)
    })

    test.obj = {
      get value() {
        return 2
      },
    }

    expect(subscriber).toHaveBeenCalledWith(2)
    expect(test.obj.value).toBe(2)
  })

  it('works with detached references', () => {
    const test = store({ nested: { value: 1 } })
    const { nested } = test
    const subscriber = vi.fn()
    watch(() => {
      subscriber(nested.value)
    })
    subscriber.mockClear()

    test.nested = { value: 2 }

    expect(subscriber).toHaveBeenCalledWith(2)
  })

  it('works with arrays', () => {
    const test = store({ list: [1, 2, 3] })
    const subscriber = vi.fn()
    watch(() => {
      subscriber(test.list)
    })
    subscriber.mockClear()

    test.list = [4, 5, 6]

    expect(subscriber).toHaveBeenCalledWith([4, 5, 6])
    expect(test.list).toEqual([4, 5, 6])
  })

  it('works with setting new array from iterating existing array', () => {
    const test = store({ list: [1, 2, 3] })

    const newArray = [...test.list, 4]

    test.list = newArray

    console.log(test.list.length)

    expect(test.list).toEqual([1, 2, 3, 4])
  })

  it('returns all raw signals when accessing $ property', () => {
    const test = store({ value: 1, nested: { value: 2 }, arr: [1, 2, 3] })

    expect(test.$?.value.get()).toBe(test.value)
    expect(test.nested.$?.value.get()).toBe(test.nested.value)
    expect(test.$?.nested.get().$?.value.get()).toBe(test.nested.value)
    expect(test.arr.$?.[1].get()).toBe(test.arr[1])
  })
})
