import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { resolve } from "node:path";
import { runMigrations } from "@/lib/db/database";
import { SqliteFitnessRepository } from "@/lib/repositories/fitnessRepository";
import { SqliteMusicRepository, type AudioFileStore } from "@/lib/repositories/musicRepository";
import { reconcileRecurringReminder } from "@/lib/services/localReminders";

async function makeDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => resolve(process.cwd(), "node_modules/sql.js/dist", file),
  });
  const db = new SQL.Database();
  runMigrations(db);
  const persist = async () => {};
  return { db, persist };
}

function memoryAudioStore(): AudioFileStore & { entries: Map<string, Blob> } {
  const entries = new Map<string, Blob>();
  return {
    entries,
    async put(id, file) {
      entries.set(id, file);
    },
    async get(id) {
      return entries.get(id) ?? null;
    },
    async has(id) {
      return entries.has(id);
    },
    async delete(id) {
      entries.delete(id);
    },
  };
}

describe("personal audio persistence", () => {
  it("persists playlists, membership, and reorder across repository instances", async () => {
    const { db, persist } = await makeDatabase();
    const files = memoryAudioStore();
    const music = new SqliteMusicRepository(db, persist, files);
    const first = await music.importTrack(new File(["first"], "first.mp3", { type: "audio/mpeg" }));
    const second = await music.importTrack(
      new File(["second"], "second.wav", { type: "audio/wav" }),
    );
    const playlist = await music.createPlaylist("Workout mix");
    await music.addToPlaylist(playlist.id, first.id);
    await music.addToPlaylist(playlist.id, second.id);
    await music.moveTrack(playlist.id, second.id, -1);

    const restored = await new SqliteMusicRepository(db, persist, files).listPlaylists();
    expect(restored[0]?.name).toBe("Workout mix");
    expect(restored[0]?.tracks.map((track) => track.name)).toEqual(["second.wav", "first.mp3"]);
    expect(restored[0]?.tracks.every((track) => track.available)).toBe(true);
    expect(await new SqliteMusicRepository(db, persist, files).listTracks()).toHaveLength(2);
  });

  it("reports missing imported blobs and rejects non-audio files", async () => {
    const { db, persist } = await makeDatabase();
    const files = memoryAudioStore();
    const music = new SqliteMusicRepository(db, persist, files);
    const track = await music.importTrack(new File(["audio"], "song.mp3", { type: "audio/mpeg" }));
    files.entries.delete(track.id);

    expect((await music.listTracks())[0]).toMatchObject({ id: track.id, available: false });
    expect(await music.getAudio(track.id)).toBeNull();
    await expect(
      music.importTrack(new File(["text"], "notes.txt", { type: "text/plain" })),
    ).rejects.toThrow("Choose an audio file");
  });
});

describe("local workout reminder scheduling", () => {
  it("schedules once per occurrence, suppresses duplicates, and respects denied permission", async () => {
    const { db, persist } = await makeDatabase();
    const fitness = new SqliteFitnessRepository(db, persist);
    const mondayAtEightThirtyFive = new Date(2026, 4, 4, 8, 35);
    const reminder = {
      enabled: true,
      weekdays: [mondayAtEightThirtyFive.getDay()],
      time: "08:30",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    };
    await fitness.saveRecurringReminder(reminder);
    const notify = () => {};

    expect(
      await reconcileRecurringReminder(
        reminder,
        fitness,
        mondayAtEightThirtyFive,
        "denied",
        notify,
      ),
    ).toBe(false);
    let notificationCount = 0;
    const show = () => {
      notificationCount += 1;
    };
    expect(
      await reconcileRecurringReminder(reminder, fitness, mondayAtEightThirtyFive, "granted", show),
    ).toBe(true);
    expect(
      await reconcileRecurringReminder(reminder, fitness, mondayAtEightThirtyFive, "granted", show),
    ).toBe(false);
    expect(notificationCount).toBe(1);
    expect(
      await reconcileRecurringReminder(
        { ...reminder, enabled: false },
        fitness,
        new Date(mondayAtEightThirtyFive.getTime() + 5 * 60_000),
        "granted",
        show,
      ),
    ).toBe(false);
  });

  it("honors quiet hours and delivers a due snooze only once", async () => {
    const { db, persist } = await makeDatabase();
    const fitness = new SqliteFitnessRepository(db, persist);
    const now = new Date(2026, 4, 4, 8, 35);
    const reminder = {
      enabled: true,
      weekdays: [now.getDay()],
      time: "08:30",
      quietHoursStart: "08:00",
      quietHoursEnd: "09:00",
    };
    await fitness.saveRecurringReminder(reminder);
    let count = 0;
    const show = () => {
      count += 1;
    };
    expect(await reconcileRecurringReminder(reminder, fitness, now, "granted", show)).toBe(false);
    expect(count).toBe(0);

    const quietEnded = { ...reminder, quietHoursStart: "22:00", quietHoursEnd: "07:00" };
    await fitness.snoozeReminder(new Date(now.getTime() + 5 * 60_000).toISOString());
    const snoozeTime = new Date(now.getTime() + 6 * 60_000);
    expect(await reconcileRecurringReminder(quietEnded, fitness, snoozeTime, "granted", show)).toBe(
      true,
    );
    expect(await fitness.getReminderSnooze()).toBeNull();
    expect(await reconcileRecurringReminder(quietEnded, fitness, snoozeTime, "granted", show)).toBe(
      false,
    );
    expect(count).toBe(1);

    await fitness.snoozeReminder(new Date(now.getTime() + 5 * 60_000).toISOString());
    await fitness.saveRecurringReminder({ ...quietEnded, enabled: false });
    expect(await fitness.getReminderSnooze()).toBeNull();
  });

  it("releases a claimed occurrence if the browser cannot display the notification", async () => {
    const { db, persist } = await makeDatabase();
    const fitness = new SqliteFitnessRepository(db, persist);
    const now = new Date(2026, 4, 4, 8, 35);
    const reminder = {
      enabled: true,
      weekdays: [now.getDay()],
      time: "08:30",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    };
    await expect(
      reconcileRecurringReminder(reminder, fitness, now, "granted", () => {
        throw new Error("permission revoked");
      }),
    ).resolves.toBe(false);
    let count = 0;
    expect(
      await reconcileRecurringReminder(reminder, fitness, now, "granted", () => {
        count += 1;
      }),
    ).toBe(true);
    expect(count).toBe(1);
  });
});
