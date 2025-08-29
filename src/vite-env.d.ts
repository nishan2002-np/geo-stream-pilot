/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRACCAR_URL: string
  readonly VITE_TRACCAR_USER: string
  readonly VITE_TRACCAR_PASS: string
  readonly VITE_OPENWEATHERMAP_KEY: string
  readonly VITE_USE_WEATHER: string
  readonly VITE_USE_TRAFFIC: string
  readonly VITE_DEMO_MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}