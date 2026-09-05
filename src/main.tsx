import { StrictMode, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ThemeProvider } from './theme/ThemeProvider';

const root = createRoot(document.getElementById('root')!);

async function bootstrap() {
  if (import.meta.env.DEV) {
    const devRoutes: Record<string, () => Promise<ReactElement>> = {
      '#/__theme': async () => {
        const { ThemeGallery } = await import('./dev/ThemeGallery');
        return <ThemeGallery />;
      },
      '#/__components': async () => {
        const { ComponentGallery } = await import('./dev/ComponentGallery');
        return <ComponentGallery />;
      },
      '#/__identity': async () => {
        const { IdentityGallery } = await import('./dev/IdentityGallery');
        return <IdentityGallery />;
      },
      '#/__rank': async () => {
        const { RankGallery } = await import('./dev/RankGallery');
        return <RankGallery />;
      },
    };
    const match = Object.entries(devRoutes).find(([prefix]) => location.hash.startsWith(prefix));
    if (match) {
      root.render(
        <StrictMode>
          <ThemeProvider>{await match[1]()}</ThemeProvider>
        </StrictMode>,
      );
      return;
    }
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
