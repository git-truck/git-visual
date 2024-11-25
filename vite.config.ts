import { vitePlugin as remix } from "@remix-run/dev"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"
import { installGlobals } from "@remix-run/node"
import pkg from "./package.json"
import { cjsInterop } from "vite-plugin-cjs-interop"

installGlobals()

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["duckdb-async"]
    }
  },
  ssr: {
    external: ["duckdb-async"]
  },
  optimizeDeps: {
    entries: [],
    exclude: ["@mapbox/node-pre-gyp", "aws-sdk", "nock", "mock-aws-s3"]
  },
  plugins: [
    remix({
      appDirectory: "src",
      serverModuleFormat: "esm",
      future: {
        v3_singleFetch: true,
        v3_fetcherPersist: true,
        v3_lazyRouteDiscovery: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true
      }
    }),
    tsconfigPaths(),
    cjsInterop({
      dependencies: process.env.NODE_ENV === "production" ? ["@mdi/react"] : []
    })
  ],
  define: {
    "process.env.PACKAGE_VERSION": JSON.stringify(pkg.version)
  },
  test: {
    globals: true,
    exclude: ["e2e", "node_modules"]
  }
})
