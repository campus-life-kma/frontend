import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MsalProvider } from '@azure/msal-react';
import './index.css';
import App from './App.tsx';
import { msalInstance } from './api/msal-config';

/** Глобальний клієнт для керування запитами React Query. */
const queryClient = new QueryClient();

// Ініціалізуємо екземпляр MSAL для автентифікації Microsoft
await msalInstance.initialize();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </MsalProvider>
  </StrictMode>
);
