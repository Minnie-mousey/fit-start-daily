import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import sprout from "@/assets/sprout.png";
import { Page, PageHeader, Panel, SectionTitle } from "@/components/app/Page";
import { ErrorState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useClearWorkoutData, useWorkoutSessions } from "@/hooks/use-workout-sessions";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Little by Little" },
      { name: "description", content: "Your profile and data on this device." },
      { property: "og:title", content: "Profile — Little by Little" },
      { property: "og:description", content: "Your profile and data on this device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { stats } = useWorkoutSessions();
  const clear = useClearWorkoutData();
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState(false);

  return (
    <Page>
      <PageHeader title="Profile" />
      <Panel className="flex items-center gap-4">
        <img src={sprout} alt="" width={816} height={816} loading="lazy" className="h-16 w-16 rounded-2xl bg-sun object-contain" />
        <div>
          <p className="font-display text-lg font-semibold">Your journey</p>
          <p className="text-sm text-muted-foreground">
            {stats.totalWorkouts} workouts · {stats.totalMinutes} minutes · best habit: showing up
          </p>
        </div>
      </Panel>

      <SectionTitle>Your data</SectionTitle>
      <Panel>
        <p className="text-sm text-muted-foreground">
          Workouts are stored privately on this device. Clearing your browser data will remove them.
        </p>
        <Button variant="outline" className="mt-4 text-destructive" onClick={() => setOpen(true)} disabled={clear.isPending}>
          <Trash2 aria-hidden /> Delete workout history
        </Button>
        {cleared && clear.isSuccess && <p className="mt-3 text-sm font-bold text-success" role="status">History deleted.</p>}
        {clear.isError && <div className="mt-3"><ErrorState message={clear.error.message} /></div>}
      </Panel>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all workout history?</AlertDialogTitle>
            <AlertDialogDescription>This removes every saved session from this device. It can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => clear.mutate(undefined, { onSuccess: () => setCleared(true) })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
