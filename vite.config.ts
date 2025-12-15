import { univerPlugin } from '@univerjs/vite-plugin'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import packageJson from './package.json'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const viteConfig = ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return defineConfig({
    plugins: [
      react(),
      univerPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env.UNIVER_CLIENT_LICENSE': JSON.stringify(env.UNIVER_CLIENT_LICENSE || ''),
      'process.env.UNIVER_VERSION': JSON.stringify(packageJson.dependencies['@univerjs/presets']),
    },
    server: {
      port: 3002,
      host: true,
    },
    build: {
      outDir: 'build',
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'univer-vendor': ['@univerjs/presets', '@univerjs/preset-sheets-core'],
          },
        },
      },
    },
  })
}

export default viteConfig

