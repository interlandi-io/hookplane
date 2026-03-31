import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig(() => {
    return {
        resolve: {
            alias: {
                '~': path.resolve(__dirname, './src')
            }
        },
        test: {
            globals: true, 
            include: ['./test/*.test.ts']
        },
    }
})
