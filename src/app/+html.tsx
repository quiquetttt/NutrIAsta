import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#071a2f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="NutrIAsta" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: rootStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const rootStyles = `
  :root {
    --na-navy: #071a2f; --na-navy-soft: #12304e; --na-green: #24c978;
    --na-green-dark: #11784b; --na-mint: #dcf8ea; --na-paper: #fff;
    --na-canvas: #f4f7f5; --na-ink: #0d1f2d; --na-muted: #64727c;
    --na-border: #dce5df; --na-focus: #4a90c2;
    color-scheme: light;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-text-size-adjust: 100%;
  }
  html, body, #root { min-width: 0; min-height: 100%; background: var(--na-canvas); }
  html, body { overflow-x: clip; }
  body { margin: 0; color: var(--na-ink); overscroll-behavior-y: none; }
  * { box-sizing: border-box; }
  button, input { font: inherit; }
  button:focus-visible, input:focus-visible, [tabindex]:focus-visible {
    outline: 3px solid var(--na-focus); outline-offset: 2px;
  }
  .na-shell { width: 100%; min-width: 0; }
  .na-rail { display: none; }
  .na-surface { min-width: 0; min-height: 100dvh; background: var(--na-canvas); }
  .na-header {
    position: sticky; z-index: 20; top: 0; display: flex; align-items: flex-end;
    justify-content: space-between; gap: 12px; padding:
      calc(16px + env(safe-area-inset-top, 0px))
      max(16px, env(safe-area-inset-right, 0px)) 12px
      max(16px, env(safe-area-inset-left, 0px));
    background: rgb(244 247 245 / 94%); border-bottom: 1px solid rgb(220 229 223 / 82%);
    backdrop-filter: blur(18px);
  }
  .na-header p { margin: 0 0 3px; color: var(--na-green-dark); font-size: .7rem; font-weight: 850; letter-spacing: .09em; }
  .na-header h1 { margin: 0; font-size: clamp(1.65rem, 7vw, 2rem); line-height: 1.05; letter-spacing: -.035em; }
  .na-network { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; padding: 7px 10px; color: var(--na-navy-soft); font-size: .75rem; font-weight: 800; background: #e9eef2; border-radius: 999px; }
  .na-header-status { display: grid; justify-items: end; gap: 4px; }
  .na-header-status small { color: var(--na-muted); font-size: .68rem; font-weight: 750; }
  .na-network.is-offline { color: #8a5300; background: #fff2d8; }
  .na-status-dot { width: 8px; height: 8px; background: var(--na-green); border-radius: 50%; box-shadow: 0 0 0 3px rgb(36 201 120 / 15%); }
  .na-network.is-offline .na-status-dot, .na-status-dot.is-offline { background: #c77a08; }
  .na-content {
    display: grid; width: 100%; max-width: 760px; min-width: 0; margin: 0 auto;
    padding: 16px max(16px, env(safe-area-inset-right, 0px))
      calc(94px + env(safe-area-inset-bottom, 0px))
      max(16px, env(safe-area-inset-left, 0px)); gap: 16px;
  }
  .na-content > * { min-width: 0; }
  .na-bottom-nav {
    position: fixed; z-index: 30; right: 0; bottom: 0; left: 0; display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr)); padding: 7px
      max(4px, env(safe-area-inset-right, 0px))
      calc(7px + env(safe-area-inset-bottom, 0px))
      max(4px, env(safe-area-inset-left, 0px));
    background: rgb(255 255 255 / 96%); border-top: 1px solid var(--na-border);
    box-shadow: 0 -12px 30px rgb(7 26 47 / 8%); backdrop-filter: blur(18px);
  }
  .na-nav-item {
    display: flex; min-width: 0; min-height: 52px; align-items: center; justify-content: center;
    gap: 2px; padding: 5px 2px; color: var(--na-muted); font-size: clamp(.63rem, 2.8vw, .72rem);
    font-weight: 750; background: transparent; border: 0; border-radius: 13px;
    flex-direction: column; -webkit-tap-highlight-color: transparent;
  }
  .na-nav-item[aria-current="page"] { color: var(--na-green-dark); background: var(--na-mint); }
  .na-nav-icon { display: grid; place-items: center; }
  .na-pending {
    position: sticky; z-index: 25; top: 0; display: flex; align-items: center; justify-content: center;
    gap: 9px; min-height: 44px; padding: 9px 16px; color: var(--na-navy);
    font-size: .82rem; background: #fff2d8; border-bottom: 1px solid #edd8a7;
  }
  .na-spinner { width: 18px; height: 18px; border: 2px solid #d8bf86; border-top-color: #8a5300; border-radius: 50%; animation: na-spin .8s linear infinite; }
  .na-section-nav { display: flex; min-width: 0; gap: 8px; overflow-x: auto; padding: 2px; scrollbar-width: none; }
  .na-section-nav::-webkit-scrollbar { display: none; }
  .na-section-nav button { min-height: 44px; flex: 1 0 auto; padding: 10px 14px; color: var(--na-navy); font-weight: 800; background: #fff; border: 1px solid var(--na-border); border-radius: 13px; }
  .na-section-nav button[aria-selected="true"] { color: #fff; background: var(--na-navy); border-color: var(--na-navy); }
  .na-empty { display: grid; gap: 10px; padding: 24px; background: #fff; border: 1px solid var(--na-border); border-radius: 22px; box-shadow: 0 10px 30px rgb(7 26 47 / 6%); }
  .na-empty h2, .na-empty p { margin: 0; }
  .na-empty p { color: var(--na-muted); line-height: 1.5; }
  @keyframes na-spin { to { transform: rotate(360deg); } }
  @media (min-width: 900px) {
    .na-shell { display: grid; grid-template-columns: 246px minmax(0, 1fr); min-height: 100dvh; }
    .na-rail { position: sticky; top: 0; display: flex; height: 100dvh; flex-direction: column; padding: 24px 18px; color: #fff; background: var(--na-navy); }
    .na-brand { display: flex; align-items: center; gap: 11px; padding: 0 8px 25px; }
    .na-brand img { border-radius: 13px; }
    .na-brand div { display: grid; }
    .na-brand strong { font-size: 1.12rem; }
    .na-brand span, .na-rail-status { color: #b9c9d5; font-size: .78rem; }
    .na-rail-nav { display: grid; gap: 7px; }
    .na-rail .na-nav-item { min-height: 48px; flex-direction: row; justify-content: flex-start; gap: 11px; padding: 10px 12px; color: #ccdae4; font-size: .9rem; }
    .na-rail .na-nav-item[aria-current="page"] { color: #fff; background: rgb(255 255 255 / 10%); }
    .na-rail-status { display: grid; grid-template-columns: 10px 1fr; align-items: center; gap: 7px; margin-top: auto; padding: 12px; }
    .na-rail-status small { grid-column: 2; }
    .na-header { padding-top: 24px; padding-right: 32px; padding-left: 32px; }
    .na-content { max-width: 980px; padding: 24px 32px 64px; }
    .na-bottom-nav { display: none; }
  }
  @media (max-width: 340px) {
    .na-content { padding-right: 12px; padding-left: 12px; }
    .na-header { padding-right: 12px; padding-left: 12px; }
    .na-network { padding: 6px 8px; }
    .na-nav-item { font-size: .6rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
  }
`;
