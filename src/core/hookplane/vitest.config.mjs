import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode: _ }) => {
    return {
        test: {
            globals: true, 
        },
    }
})
