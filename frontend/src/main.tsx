import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/theme.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/home.css';
import './styles/closet.css';
import './styles/detail.css';
import './styles/outfit.css';
import './styles/storage.css';
import './styles/notice.css';
import './styles/register.css';
import './styles/auth.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
