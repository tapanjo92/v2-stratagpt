/**
 * Phase 2.1: Frontend Foundation Tests
 * 
 * Tests for Next.js application setup, environment variables, and basic rendering
 * These tests ensure the frontend foundation is properly configured before proceeding
 */

import { spawn } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('Phase 2.1: Frontend Foundation', () => {
  const projectRoot = process.cwd()

  describe('Next.js Application Structure', () => {
    test('Required project files exist', () => {
      const requiredFiles = [
        'package.json',
        'tsconfig.json',
        'next.config.js',
        'app/layout.tsx',
        'app/page.tsx',
        'app/globals.css',
      ]

      requiredFiles.forEach(file => {
        const filePath = join(projectRoot, file)
        expect(existsSync(filePath)).toBe(true)
      })
    })

    test('Package.json contains required dependencies', () => {
      const packageJson = JSON.parse(
        readFileSync(join(projectRoot, 'package.json'), 'utf-8')
      )

      const requiredDeps = [
        'next',
        'react',
        'react-dom',
        'aws-amplify',
        '@aws-amplify/ui-react',
        '@aws-sdk/client-dynamodb',
        '@aws-sdk/client-s3',
      ]

      requiredDeps.forEach(dep => {
        expect(packageJson.dependencies).toHaveProperty(dep)
      })
    })
  })

  describe('Build Process', () => {
    test('Application builds successfully', async () => {
      const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: projectRoot,
        env: { ...process.env },
      })

      await new Promise<void>((resolve, reject) => {
        let output = ''
        let errorOutput = ''

        buildProcess.stdout.on('data', (data) => {
          output += data.toString()
        })

        buildProcess.stderr.on('data', (data) => {
          errorOutput += data.toString()
        })

        buildProcess.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`Build failed with code ${code}: ${errorOutput}`))
          }
        })

        buildProcess.on('error', (error) => {
          reject(error)
        })
      })

      // Verify build output exists
      expect(existsSync(join(projectRoot, '.next'))).toBe(true)
    }, 60000) // 60 second timeout for build
  })

  describe('Environment Variables', () => {
    test('Environment variables are defined in test environment', () => {
      const requiredEnvVars = [
        'NEXT_PUBLIC_USER_POOL_ID',
        'NEXT_PUBLIC_USER_POOL_CLIENT_ID',
        'NEXT_PUBLIC_IDENTITY_POOL_ID',
        'NEXT_PUBLIC_AWS_REGION',
        'NEXT_PUBLIC_DYNAMODB_TABLE_NAME',
        'NEXT_PUBLIC_S3_DOCUMENTS_BUCKET',
        'NEXT_PUBLIC_S3_PUBLIC_BUCKET',
      ]

      requiredEnvVars.forEach(envVar => {
        expect(process.env[envVar]).toBeDefined()
        expect(process.env[envVar]).not.toBe('')
      })
    })

    test('.env.local.template exists with all required variables', () => {
      const templatePath = join(projectRoot, '.env.local.template')
      expect(existsSync(templatePath)).toBe(true)

      const templateContent = readFileSync(templatePath, 'utf-8')
      const expectedVars = [
        'NEXT_PUBLIC_USER_POOL_ID',
        'NEXT_PUBLIC_USER_POOL_CLIENT_ID',
        'NEXT_PUBLIC_IDENTITY_POOL_ID',
        'NEXT_PUBLIC_AWS_REGION',
        'NEXT_PUBLIC_DYNAMODB_TABLE_NAME',
        'NEXT_PUBLIC_S3_DOCUMENTS_BUCKET',
        'NEXT_PUBLIC_S3_PUBLIC_BUCKET',
        'OPENAI_API_KEY',
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      ]

      expectedVars.forEach(varName => {
        expect(templateContent).toContain(varName)
      })
    })
  })

  describe('AWS Amplify Configuration', () => {
    test('Amplify configuration file exists', () => {
      const configPath = join(projectRoot, 'app/lib/amplify-config.ts')
      expect(existsSync(configPath)).toBe(true)
    })

    test('Amplify configuration exports valid config object', async () => {
      // Import the config dynamically
      const configModule = await import(join(projectRoot, 'app/lib/amplify-config.ts'))
      const config = configModule.default

      expect(config).toBeDefined()
      expect(config.Auth).toBeDefined()
      expect(config.Auth.Cognito).toBeDefined()
      expect(config.Auth.Cognito.userPoolId).toBe(process.env.NEXT_PUBLIC_USER_POOL_ID)
      expect(config.Auth.Cognito.userPoolClientId).toBe(process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID)
      expect(config.Auth.Cognito.identityPoolId).toBe(process.env.NEXT_PUBLIC_IDENTITY_POOL_ID)
      expect(config.Auth.Cognito.region).toBe(process.env.NEXT_PUBLIC_AWS_REGION)
    })

    test('AmplifyProvider component exists', () => {
      const providerPath = join(projectRoot, 'app/components/AmplifyProvider.tsx')
      expect(existsSync(providerPath)).toBe(true)
    })
  })

  describe('Layout and Styling', () => {
    test('Root layout includes AmplifyProvider', () => {
      const layoutPath = join(projectRoot, 'app/layout.tsx')
      const layoutContent = readFileSync(layoutPath, 'utf-8')

      expect(layoutContent).toContain('AmplifyProvider')
      expect(layoutContent).toContain('import AmplifyProvider')
    })

    test('Global CSS file contains required styles', () => {
      const cssPath = join(projectRoot, 'app/globals.css')
      const cssContent = readFileSync(cssPath, 'utf-8')

      // Check for essential CSS variables
      expect(cssContent).toContain('--primary-color')
      expect(cssContent).toContain('--background')
      expect(cssContent).toContain('--foreground')

      // Check for basic utility classes
      expect(cssContent).toContain('.btn')
      expect(cssContent).toContain('.input')
      expect(cssContent).toContain('.container')
    })
  })

  describe('TypeScript Configuration', () => {
    test('TypeScript config is properly configured', () => {
      const tsconfigPath = join(projectRoot, 'tsconfig.json')
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'))

      expect(tsconfig.compilerOptions.strict).toBe(true)
      expect(tsconfig.compilerOptions.jsx).toBe('preserve')
      expect(tsconfig.compilerOptions.paths).toBeDefined()
      expect(tsconfig.compilerOptions.paths['@/*']).toEqual(['./*'])
    })
  })

  describe('Testing Infrastructure', () => {
    test('Jest configuration exists', () => {
      const jestConfigPath = join(projectRoot, 'jest.config.js')
      expect(existsSync(jestConfigPath)).toBe(true)
    })

    test('Jest setup file exists', () => {
      const jestSetupPath = join(projectRoot, 'jest.setup.js')
      expect(existsSync(jestSetupPath)).toBe(true)
    })
  })
})

/**
 * Gate Check: Next.js app builds and serves
 * 
 * This test ensures that:
 * 1. The application can be built without errors
 * 2. All environment variables are properly configured
 * 3. The basic structure and configuration are in place
 * 
 * Only proceed to Phase 2.2 if all these tests pass
 */