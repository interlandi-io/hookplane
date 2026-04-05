import path from 'path'
import { createGlob } from '../src/scanner/globber.js'

const tsconfigPath = path.resolve(__dirname, '../test-proj/tsconfig.json')
const hookplanePath = path.resolve(__dirname, '../test-proj/src/hookplane.ts')
const sub1Path = path.resolve(__dirname, '../test-proj/src/routes/handler_1.ts')

describe('globber', () => {
    it('globs', () => {
        const glob = createGlob(tsconfigPath)
        expect(glob.isOk()).toBe(true)
        expect(glob._unsafeUnwrap().hookplane.filePath).toBe(hookplanePath)
        expect(glob._unsafeUnwrap().hookplane.exportName).toBe('default')
        expect(glob._unsafeUnwrap().subscriptions.length).toBe(1)
        expect(glob._unsafeUnwrap().subscriptions[0]!.filePath).toBe(sub1Path)
    })
})
