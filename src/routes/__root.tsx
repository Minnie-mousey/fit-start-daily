import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BottomNav } from "@/components/app/BottomNav";
import { DatabaseProvider } from "@/hooks/use-database";
import { useGamification } from "@/hooks/use-gamification";
import { useCalendarEvents, useRecurringReminder, useReminderSnooze } from "@/hooks/use-fitness";
import { dayKey } from "@/lib/services/stats";
import {
  reconcileCalendarReminders,
  reconcileRecurringReminder,
} from "@/lib/services/localReminders";
import { useDatabase } from "@/hooks/use-database";

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
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
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
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

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
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2.5 text-sm font-bold text-foreground"
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
      { name: "theme-color", content: "#fbf5ec" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const inPlayer = useRouterState({ select: (s) => s.location.pathname.startsWith("/play/") });

  return (
    <QueryClientProvider client={queryClient}>
      <DatabaseProvider>
        <AppLayout inPlayer={inPlayer} />
      </DatabaseProvider>
    </QueryClientProvider>
  );
}

function AppLayout({ inPlayer }: { inPlayer: boolean }) {
  const { snapshot } = useGamification();
  const { state: database } = useDatabase();
  const reminder = useRecurringReminder();
  const snooze = useReminderSnooze();
  const [today, setToday] = useState(() => dayKey(new Date()));
  const todayEvents = useCalendarEvents(today, today);
  const equippedTheme = snapshot?.cosmetics.find(
    (item) => item.id === snapshot.profile.equippedThemeId,
  );
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/service-worker.js")
      .catch((error: unknown) => console.error("Could not register offline app support", error));
  }, []);
  useEffect(() => {
    const refreshDate = () => setToday(dayKey(new Date()));
    const interval = window.setInterval(refreshDate, 60_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    const schedule = reminder.data;
    if (!schedule || database.status !== "ready") return;
    if (
      (!schedule.enabled || schedule.weekdays.length === 0) &&
      !(todayEvents.data ?? []).some((event) => event.reminderEnabled) &&
      !snooze.data
    )
      return;
    if (!("Notification" in window)) return;
    let checking = false;
    const checkReminder = async () => {
      if (checking) return;
      checking = true;
      const now = new Date();
      try {
        await reconcileRecurringReminder(
          schedule,
          database.fitness,
          now,
          Notification.permission,
          ({ title, body }) => new Notification(title, { body }),
        );
        await reconcileCalendarReminders(
          todayEvents.data ?? [],
          schedule,
          database.fitness,
          now,
          Notification.permission,
          ({ title, body }) => new Notification(title, { body }),
        );
      } catch (error) {
        console.error("Could not reconcile workout reminders", error);
      } finally {
        checking = false;
      }
    };
    void checkReminder();
    const interval = window.setInterval(() => void checkReminder(), 20_000);
    const resume = () => void checkReminder();
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [database, reminder.data, snooze.data, todayEvents.data]);
  return (
    <div
      className={`min-h-screen bg-background text-foreground ${equippedTheme?.themeClass ?? "theme-meadow"}`}
    >
      <Outlet />
      {!inPlayer && <BottomNav />}
    </div>
  );
}
