import { useEffect, useState } from 'react';
import Home from './components/Home';
import { IconMoon, IconSun } from './components/Icons';
import SessionView from './components/SessionView';

type Theme = 'light' | 'dark';

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('td-theme');
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const route = () => window.location.hash.replace(/^#\/?/, '');

export default function App() {
  const [path, setPath] = useState(route());
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const h = () => setPath(route());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d0f12' : '#f3f4f6');
    try {
      localStorage.setItem('td-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const go = (p: string) => {
    window.location.hash = `/${p}`;
    window.scrollTo(0, 0);
  };
  const toggle = (
    <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  );

  const m = path.match(/^s\/(.+)$/);
  if (m) return <SessionView id={m[1]} onBack={() => go('')} onOpen={(id) => go(`s/${id}`)} themeToggle={toggle} />;
  return <Home onOpen={(id) => go(`s/${id}`)} themeToggle={toggle} />;
}
