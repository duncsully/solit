import { describe, expect, it } from 'vitest'
import { computedGroup } from './computedGroup'

describe('computedGroup', () => {
  it('returns computeds for each value', () => {
    const numbers = [1, 2, 3, 5, 7, 8]

    const { odd, even } = computedGroup(() => {
      const odd = numbers.filter((n) => n % 2 === 1)
      const even = numbers.filter((n) => n % 2 === 0)
      return { odd, even }
    })

    expect(odd.get()).toEqual([1, 3, 5, 7])
    expect(even.get()).toEqual([2, 8])
  })

  it('works with arrays', () => {
    const numbers = [1, 2, 3, 5, 7, 8]

    const [odd, even] = computedGroup(() => {
      const odd = numbers.filter((n) => n % 2 === 1)
      const even = numbers.filter((n) => n % 2 === 0)
      return [odd, even]
    })

    expect(odd.get()).toEqual([1, 3, 5, 7])
    expect(even.get()).toEqual([2, 8])
  })
})
