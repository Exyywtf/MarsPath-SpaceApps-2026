import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([...nextVitals, ...nextTs, globalIgnores(['out/**', '.next/**', 'public/route-worker.js', 'all our mars info/**', 'tmp/**', 'test-results/**', 'playwright-report/**'])]);
