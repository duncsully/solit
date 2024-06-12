import { createContext } from './context'
import { describe, expect, it } from 'vitest'

describe('context', () => {
  describe('createContext', () => {
    it('creates an object with a getter for the default value', () => {
      const context = createContext('value')
      expect(context.value).toBe('value')
    })

    it('creates an object with a provide method that sets the value for the callback', () => {
      const context = createContext('value')
      context.provide('new value', () => {
        expect(context.value).toBe('new value')
      })
    })

    it('works no matter how deep the consumer is', () => {
      const context = createContext('value')

      context.provide('new value', () => {
        const someFunction = () => {
          expect(context.value).toBe('new value')
        }
        const otherFunction = () => {
          someFunction()
        }
        otherFunction()
      })
    })

    it('works with nested provides', () => {
      const context = createContext('value')
      context.provide('new value', () => {
        context.provide('newer value', () => {
          expect(context.value).toBe('newer value')
        })
        expect(context.value).toBe('new value')
      })
    })

    it('returns callback return value from provide', () => {
      const context = createContext('value')
      const result = context.provide('new value', () => 'result')
      expect(result).toBe('result')
    })

    it('works with async functions', async () => {
      const context = createContext('value')
      const result = await context.provideAsync('new value', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        expect(context.value).toBe('new value')
        return 'result'
      })
      expect(context.value).toBe('value')
      expect(result).toBe('result')
    })
  })
})
