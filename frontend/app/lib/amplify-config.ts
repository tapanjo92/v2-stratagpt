import { Amplify } from 'aws-amplify'

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
      identityPoolId: process.env.NEXT_PUBLIC_IDENTITY_POOL_ID!,
      region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
      signUpVerificationMethod: 'code' as const,
      loginWith: {
        email: true,
      },
      mfa: {
        status: 'on' as const,
        totpEnabled: true,
        smsEnabled: true,
      },
      passwordFormat: {
        minLength: 12,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
        requireUppercase: true,
      },
    },
  },
}

export function configureAmplify() {
  if (typeof window !== 'undefined') {
    Amplify.configure(amplifyConfig)
  }
}

export default amplifyConfig