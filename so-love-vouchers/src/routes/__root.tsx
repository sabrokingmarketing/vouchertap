import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";

import appCss from "../styles.css?url";

// Critical, inline preloader styles — injected into <head> so the overlay is
// fully styled on the very first paint, before the external stylesheet loads.
// App content stays hidden until the fade completes (html.app-ready) so fixed
// mobile nav/footer cannot flash through the semi-transparent overlay.
// Fixed px logo — vw/aspect-ratio/transform centering all resize after paint and cause jump.
const PRELOADER_LOGO_W = 280;
const PRELOADER_LOGO_H = 161;

const PRELOADER_HTML = `<div id="app-preloader" aria-hidden="true" style="position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;opacity:1;visibility:visible;pointer-events:auto;overflow:hidden;margin:0;padding:0;background:#ffffff"><div class="slk-backdrop" style="position:absolute;inset:0;background:#ffffff;z-index:0;margin:0;padding:0"></div><div class="slk-logo" role="img" aria-label="So Love Krugersdorp" style="position:relative;z-index:1;width:${PRELOADER_LOGO_W}px;height:${PRELOADER_LOGO_H}px;margin:0;padding:0;border:0;background:url(/preloader-logo.png) center/contain no-repeat;transform:none;flex-shrink:0"></div></div>`;

const PRELOADER_CSS = `
html,body{background:#ffffff!important}
html:not(.app-ready){overflow:hidden!important}
html:not(.app-ready) body>*:not(#app-preloader):not(script){visibility:hidden!important;opacity:0!important;pointer-events:none!important}
#app-preloader{position:fixed!important;inset:0!important;z-index:2147483647!important;display:grid!important;place-items:center!important;opacity:1;visibility:visible;transition:opacity .7s ease,visibility 0s linear .7s;will-change:opacity;pointer-events:auto;overflow:hidden!important;margin:0!important;padding:0!important;background:#ffffff!important}
#app-preloader.is-hidden{opacity:0;pointer-events:none;visibility:hidden}
html.preloader-skip #app-preloader,html.preloader-done #app-preloader{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}
#app-preloader .slk-backdrop{position:absolute!important;inset:0!important;background:#ffffff!important;z-index:0!important;margin:0!important;padding:0!important}
#app-preloader .slk-logo{position:relative!important;top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;transform:none!important;width:${PRELOADER_LOGO_W}px!important;height:${PRELOADER_LOGO_H}px!important;min-width:${PRELOADER_LOGO_W}px!important;min-height:${PRELOADER_LOGO_H}px!important;max-width:${PRELOADER_LOGO_W}px!important;max-height:${PRELOADER_LOGO_H}px!important;background:url(/preloader-logo.png) center/contain no-repeat!important;z-index:1!important;pointer-events:none!important;margin:0!important;padding:0!important;border:0!important;transition:none!important;flex-shrink:0!important}
`;

const PRELOADER_SESSION_JS = `
(function(){
  try{
    if(sessionStorage.getItem('slk-preloader-shown')==='1'){
      document.documentElement.classList.add('app-ready','preloader-skip','preloader-done');
    }
  }catch(e){}
})();
`;

// Runs synchronously right after preloader markup — locks layout before rest of body paints.
const PRELOADER_LOCK_JS = `
(function(){
  var el=document.getElementById('app-preloader');
  var logo=el&&el.querySelector('.slk-logo');
  if(!el||!logo)return;
  el.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;opacity:1;visibility:visible;pointer-events:auto;overflow:hidden;margin:0;padding:0;background:#fff';
  logo.style.cssText='position:relative;z-index:1;width:${PRELOADER_LOGO_W}px;height:${PRELOADER_LOGO_H}px;margin:0;padding:0;border:0;background:url(/preloader-logo.png) center/contain no-repeat;transform:none;flex-shrink:0';
})();
`;

// Self-contained fade-out — runs immediately on parse, with NO dependency on
// React/hydration. Content stays hidden until the opacity transition ends so
// fixed mobile nav cannot bleed through during the fade.
//
// IMPORTANT: we only toggle classes — we never remove the node from the DOM.
// The overlay lives inside React's hydrated shell, so deleting it would race
// React's streaming hydration on data-heavy routes and throw.
const PRELOADER_JS = `
(function(){
  var KEY='slk-preloader-shown';
  function markSeen(){try{sessionStorage.setItem(KEY,'1')}catch(e){}}
  function hasSeen(){try{return sessionStorage.getItem(KEY)==='1'}catch(e){return document.documentElement.classList.contains('preloader-done')}}
  function finish(el,instant){
    document.documentElement.classList.add('app-ready');
    if(!el){document.documentElement.classList.add('preloader-done');return;}
    if(instant){
      el.classList.add('is-hidden');
      document.documentElement.classList.add('preloader-skip','preloader-done');
      if(el.parentNode)el.parentNode.removeChild(el);
      return;
    }
    el.classList.add('is-hidden');
    setTimeout(function(){
      document.documentElement.classList.add('preloader-done');
      if(el&&el.parentNode)el.parentNode.removeChild(el);
    },900);
  }
  function run(){
    var el=document.getElementById('app-preloader');
    if(!el){setTimeout(run,50);return;}
    if(hasSeen()){finish(el,true);return;}
    markSeen();
    finish(el,false);
  }
  run();
})();
`;

// Installability plumbing, kept out of React on purpose.
//
// `beforeinstallprompt` fires once, early, and is often gone before hydration —
// so it is captured here and stashed for the install page to use later. It also
// has to be preventDefault()ed or Chrome shows its own mini-infobar alongside
// our button. The service worker is registered on load rather than only when a
// member enables push, because Chromium won't offer an install prompt at all
// without a live worker.
const PWA_INSTALL_JS = `
(function(){
  window.__slkInstall={event:null};
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault();
    window.__slkInstall.event=e;
    window.dispatchEvent(new Event('slk:install-available'));
  });
  window.addEventListener('appinstalled',function(){
    window.__slkInstall.event=null;
    try{localStorage.setItem('slk.pwa_installed_v1','1')}catch(e){}
    window.dispatchEvent(new Event('slk:installed'));
  });
  if('serviceWorker' in navigator){
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});
    });
  }
})();
`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "So Love Krugersdorp" },
      {
        name: "description",
        content: "Members-only vouchers and upcoming events for So Love Krugersdorp.",
      },
      { name: "theme-color", content: "#e11d2a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "So Love" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "So Love Krugersdorp" },
      {
        property: "og:description",
        content:
          "So Love Vouchers is a PWA for clients to view and claim exclusive digital vouchers and event information.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "So Love Krugersdorp" },
      {
        name: "description",
        content:
          "So Love Vouchers is a PWA for clients to view and claim exclusive digital vouchers and event information.",
      },
      {
        name: "twitter:description",
        content:
          "So Love Vouchers is a PWA for clients to view and claim exclusive digital vouchers and event information.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/35963f43-f843-40cb-90c2-52a42c828c6b/id-preview-8725291a--e813bc15-1aea-4b15-bb90-5a96c13b072f.lovable.app-1779875469542.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/35963f43-f843-40cb-90c2-52a42c828c6b/id-preview-8725291a--e813bc15-1aea-4b15-bb90-5a96c13b072f.lovable.app-1779875469542.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preload", as: "image", href: "/preloader-logo.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;450;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRELOADER_SESSION_JS }} />
        <script dangerouslySetInnerHTML={{ __html: PWA_INSTALL_JS }} />
        <style dangerouslySetInnerHTML={{ __html: PRELOADER_CSS }} />
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {/* Static HTML preloader — not React-managed, so hydration cannot reposition it. */}
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: PRELOADER_HTML }} />
        <script dangerouslySetInnerHTML={{ __html: PRELOADER_LOCK_JS }} />
        <script dangerouslySetInnerHTML={{ __html: PRELOADER_JS }} />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
