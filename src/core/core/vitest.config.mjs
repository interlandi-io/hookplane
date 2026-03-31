import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(() => {
    return {
        plugins: [tsconfigPaths()],
        test: {
            globals: true, 
            include: ['./test/*.test.ts']
        },
    }
})
