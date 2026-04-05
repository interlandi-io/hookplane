import path from 'path'
import { scan } from '../src/scanner/scanner.js'

const tsconfigPath = path.resolve(__dirname, '../test-proj/tsconfig.json')
const hookplanePath = path.resolve(__dirname, '../test-proj/src/hookplane.ts')
const sub1Path = path.resolve(__dirname, '../test-proj/src/routes/handler_1.ts')

describe('scanner', () => {
    it('scans', async () => {
        const result = await scan(path.resolve(tsconfigPath))
        console.log(result)
    })
})
