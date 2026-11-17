import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { ClassList } from './ui/ClassList';
import { ClassView } from './ui/ClassView';
import { AppSettings } from './ui/AppSettings';

/** Einfaches Hash-Routing: #/klasse/<id>/fach/<id> usw. */
function useHashRoute(): string[] {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function App() {
  const route = useHashRoute();
  // Aktuelles Schuljahr = das mit dem spätesten Beginn
  const schoolYear = useLiveQuery(async () => {
    const all = await db.schoolYears.toArray();
    return all.sort((a, b) => b.start.localeCompare(a.start))[0] ?? null;
  });

  if (!schoolYear) return <p className="loading">Lade …</p>;

  let page;
  if (route[0] === 'klasse' && route[1]) {
    page = <ClassView classId={route[1]} section={route[2]} subjectId={route[3]} schoolYear={schoolYear} />;
  } else if (route[0] === 'einstellungen') {
    page = <AppSettings schoolYear={schoolYear} />;
  } else {
    page = <ClassList schoolYear={schoolYear} />;
  }

  return (
    <>
      <header className="topbar">
        <a href="#/" className="brand">
          Grader
        </a>
        <span className="topbar-year">Schuljahr {schoolYear.name}</span>
        <nav>
          <a href="#/einstellungen" className={route[0] === 'einstellungen' ? 'active' : undefined}>
            Einstellungen &amp; Backup
          </a>
        </nav>
      </header>
      <main>{page}</main>
    </>
  );
}
