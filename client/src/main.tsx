import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/main.css';

// Disable StrictMode in development to prevent double API calls
// StrictMode intentionally double-invokes useEffect in dev mode
const isDev = import.meta.env.DEV;

ReactDOM.createRoot(document.getElementById('root')!).render(
  isDev ? (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  ) : (
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  ),
);
