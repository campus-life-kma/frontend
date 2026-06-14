import {
  PublicClientApplication,
  type Configuration,
  type RedirectRequest,
} from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
const redirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI;

/**
 * Конфігурація для клієнтської бібліотеки
 * Microsoft Authentication Library (MSAL).
 */
const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

/** Екземпляр MSAL додатка для входу через Microsoft Office 365. */
export const msalInstance = new PublicClientApplication(msalConfig);

/** Запит на авторизацію в Microsoft з необхідними дозволами. */
export const msalLoginRequest: RedirectRequest = {
  scopes: ['User.Read'],
  prompt: 'select_account',
};
