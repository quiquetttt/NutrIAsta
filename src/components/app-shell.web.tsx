import type { ReactNode } from 'react';

export type AppDestination = 'today' | 'diary' | 'training' | 'inventory' | 'profile';

const NAV_ITEMS: Array<{ id: AppDestination; label: string; icon: ReactNode }> = [
  { id: 'today', label: 'Hoy', icon: <HomeIcon /> },
  { id: 'diary', label: 'Diario', icon: <DiaryIcon /> },
  { id: 'training', label: 'Entrenar', icon: <TrainingIcon /> },
  { id: 'inventory', label: 'Inventario', icon: <InventoryIcon /> },
  { id: 'profile', label: 'Perfil', icon: <ProfileIcon /> },
];

const TITLES: Record<AppDestination, { eyebrow: string; title: string }> = {
  today: { eyebrow: 'TU REGISTRO LOCAL', title: 'Hoy' },
  diary: { eyebrow: 'NUTRICIÓN', title: 'Diario' },
  training: { eyebrow: 'ACTIVIDAD', title: 'Entrenar' },
  inventory: { eyebrow: 'ALIMENTOS EN CASA', title: 'Inventario' },
  profile: { eyebrow: 'DATOS Y PRIVACIDAD', title: 'Perfil' },
};

export function AppShell({
  destination,
  onNavigate,
  online,
  version,
  pending,
  children,
}: {
  destination: AppDestination;
  onNavigate: (destination: AppDestination) => void;
  online: boolean;
  version: string;
  pending: boolean;
  children: ReactNode;
}) {
  const heading = TITLES[destination];
  const navigation = (
    <>
      {NAV_ITEMS.map((item) => (
        <button
          aria-current={destination === item.id ? 'page' : undefined}
          className="na-nav-item"
          key={item.id}
          onClick={() => onNavigate(item.id)}
          type="button"
        >
          <span aria-hidden="true" className="na-nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </>
  );

  return (
    <div className="na-shell">
      <aside aria-label="Navegación principal" className="na-rail">
        <div className="na-brand">
          <img alt="" height="48" src="/icons/icon-192.png" width="48" />
          <div><strong>NutrIAsta</strong><span>Registro local</span></div>
        </div>
        <nav className="na-rail-nav">{navigation}</nav>
        <div className="na-rail-status">
          <span aria-hidden="true" className={`na-status-dot ${online ? '' : 'is-offline'}`} />
          <span>{online ? 'Online' : 'Offline'}</span>
          <small>Versión {version}</small>
        </div>
      </aside>

      <div className="na-surface">
        {pending ? (
          <div aria-live="polite" className="na-pending" role="status">
            <span aria-hidden="true" className="na-spinner" />
            <strong>Terminando una operación local…</strong>
          </div>
        ) : null}
        <header className="na-header">
          <div>
            <p>{heading.eyebrow}</p>
            <h1>{heading.title}</h1>
          </div>
          <div className="na-header-status">
            <span className={`na-network ${online ? '' : 'is-offline'}`}>
              <span aria-hidden="true" className="na-status-dot" />
              {online ? 'Online' : 'Offline'}
            </span>
            <small><span>nutriasta-main</span> · Versión {version}</small>
          </div>
        </header>
        <main className="na-content" id="contenido-principal">{children}</main>
        <nav aria-label="Navegación principal" className="na-bottom-nav">{navigation}</nav>
      </div>
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
      {children}
    </svg>
  );
}

function HomeIcon() {
  return <Icon><path d="M3 11.2 12 4l9 7.2V21h-6v-6H9v6H3v-9.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></Icon>;
}
function DiaryIcon() {
  return <Icon><path d="M6 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" /><path d="M8 4v16M11 9h6M11 13h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></Icon>;
}
function TrainingIcon() {
  return <Icon><path d="M5 9v6M2.5 10.5v3M19 9v6M21.5 10.5v3M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></Icon>;
}
function InventoryIcon() {
  return <Icon><path d="M4 8h16l-1 12H5L4 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="M8 8a4 4 0 0 1 8 0M8 12h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></Icon>;
}
function ProfileIcon() {
  return <Icon><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" /><path d="M5 20c.5-4 2.8-6 7-6s6.5 2 7 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></Icon>;
}
