import {
  PublicClientApplication,
  type Configuration,
  type PopupRequest,
} from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
const redirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI;

const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const msalLoginRequest: PopupRequest = {
  scopes: ['User.Read'],
  prompt: 'select_account',
};
