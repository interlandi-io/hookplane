import { extract } from './extract.js'

describe('extract', () => {
    it('extracts', async () => {
        const result = await extract('default', '../test-proj/src/hookplane.ts')
        expect(result.isOk()).toBe(true)
        const state = result._unsafeUnwrap()
        expect(state.baseUrl).toBe('https://localhost:3000')
        expect(state.providers['stripe']).toBeDefined()
    })
})
