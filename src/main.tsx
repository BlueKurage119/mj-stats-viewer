import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ThemeProvider } from './theme/ThemeProvider';

const root = createRoot(document.getElementById('root')!);

async function bootstrap() {
  if (import.meta.env.DEV && location.hash.startsWith('#/__theme')) {
    const { ThemeGallery } = await import('./dev/ThemeGallery');
    root.render(
      <StrictMode>
        <ThemeProvider>
          <ThemeGallery />
        </ThemeProvider>
      </StrictMode>,
    );
    return;
  }

  root.render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
}

void bootstrap();
