import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { createWebRuntime } from './app/composition';
import './index.css';

const runtime = createWebRuntime();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App runtime={runtime} />
    </BrowserRouter>
  </StrictMode>,
);
