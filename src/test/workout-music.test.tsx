import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkoutMusicControls } from "@/components/app/WorkoutMusicControls";

const hooks = vi.hoisted(() => ({
  playlists: vi.fn(),
  audio: vi.fn(),
}));

vi.mock("@/hooks/use-fitness", () => ({
  usePlaylists: hooks.playlists,
  useAudioFile: hooks.audio,
}));

const playlist = {
  id: "playlist-1",
  name: "Morning mix",
  createdAt: "2026-10-17T00:00:00.000Z",
  tracks: [
    {
      id: "track-1",
      name: "Morning song.mp3",
      mimeType: "audio/mpeg",
      sizeBytes: 5,
      lastModified: 0,
      importedAt: "2026-10-17T00:00:00.000Z",
      available: true,
    },
  ],
};

describe("workout music playback controls", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    hooks.playlists.mockReturnValue({ data: [playlist], isError: false });
    hooks.audio.mockReturnValue({ data: new Blob(["audio"]), isPending: false });
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:workout-audio"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("reports audio decoder errors instead of silently failing playback", async () => {
    render(<WorkoutMusicControls />);
    const audio = await screen.findByLabelText("Play Morning song.mp3");
    fireEvent.error(audio);
    expect(screen.getByText(/could not decode the file.*supported MP3/i)).toBeInTheDocument();
  });

  it("explains when a restored playlist entry has no local audio copy", () => {
    hooks.playlists.mockReturnValue({
      data: [{ ...playlist, tracks: [{ ...playlist.tracks[0], available: false }] }],
      isError: false,
    });
    hooks.audio.mockReturnValue({ data: null, isPending: false });
    render(<WorkoutMusicControls />);
    expect(screen.getByText(/Audio file missing/)).toBeInTheDocument();
  });

  it("handles an audio copy disappearing after playlist metadata was loaded", () => {
    hooks.audio.mockReturnValue({ data: null, isPending: false });
    render(<WorkoutMusicControls />);
    expect(screen.getByText(/Audio file missing/)).toBeInTheDocument();
  });
});
