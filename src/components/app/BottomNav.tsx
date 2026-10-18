import { Link } from "@tanstack/react-router";
import { CalendarDays, Dumbbell, Home, TrendingUp } from "lucide-react";
import { EquippedAvatar } from "@/components/app/EquippedAvatar";
import { useGamification } from "@/hooks/use-gamification";

const ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/workout", label: "Workout", icon: Dumbbell, exact: false },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, exact: false },
  { to: "/progress", label: "Progress", icon: TrendingUp, exact: false },
  { to: "/profile", label: "Profile", icon: null, exact: false },
] as const;

export function BottomNav() {
  const { snapshot } = useGamification();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md justify-around px-2">
        {ITEMS.map(({ to, label, exact, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact }}
              className="group flex flex-col items-center gap-1 py-2.5 text-xs font-bold text-muted-foreground transition-colors data-[status=active]:text-primary"
            >
              <span className="flex h-8 w-12 items-center justify-center rounded-full transition-colors group-data-[status=active]:bg-primary-soft">
                {Icon ? (
                  <Icon className="h-5 w-5" aria-hidden />
                ) : (
                  <EquippedAvatar
                    snapshot={snapshot}
                    alt=""
                    className="h-7 w-7 rounded-full object-contain"
                    badgeClassName="h-5 w-5"
                    compact
                  />
                )}
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
