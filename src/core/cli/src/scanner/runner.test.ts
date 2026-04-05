import { createRunner } from './runner.js'

describe('runner', () => {
    it('runs', async () => {
        const code = `
export default 'asdfasdfasdf'
        `
        const runner = createRunner<{ default: string }>(code, __dirname)
        await runner.run()
        expect(runner.err()).toBeUndefined()
        expect(runner.mod()).toBeDefined()
        expect(runner.mod()!.default).toBe('asdfasdfasdf')
    })
})
