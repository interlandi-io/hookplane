import { extract } from './extract.js'

describe('extract', () => {
    it('extracts', async () => {
        const result = await extract('default', '../test-proj/src/hookplane.ts')
        if (result.isErr()) {
            throw new Error(
                `Extraction failed: ${JSON.stringify(result.error)}`,
            )
        }
        const state = result.value
        expect(state.baseUrl).toBe('https://localhost:3000')
        expect(state.providers['stripe']).toBeDefined()
        expect(state.providerStates['stripe']).toBeDefined()
        const arr = [...state.providerStates['stripe']!.values()]
        expect(arr[0]).toBeDefined()
        expect(arr[0]!.relativeUrl).toBe('/hooks/stripe')
        expect(arr[0]!.events[0]).toBe('checkout.session.completed')
    })
})
