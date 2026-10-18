import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Music2 } from "lucide-react";
import { useAudioFile, usePlaylists } from "@/hooks/use-fitness";
import { Button } from "@/components/ui/button";

export function WorkoutMusicControls() {
  const playlistsQuery = usePlaylists();
  const playlists = playlistsQuery.data ?? [];
  const [playlistId, setPlaylistId] = useState("");
  const [trackIndex, setTrackIndex] = useState(0);
  const playlist = playlists.find((item) => item.id === playlistId) ?? playlists[0];
  const track = playlist?.tracks[trackIndex];
  const audioQuery = useAudioFile(track?.id);
  const [source, setSource] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    if (playlist && playlist.id !== playlistId) {
      setPlaylistId(playlist.id);
      setTrackIndex(0);
    } else if (playlist && trackIndex >= playlist.tracks.length) {
      setTrackIndex(Math.max(0, playlist.tracks.length - 1));
    }
  }, [playlist, playlistId, trackIndex]);

  useEffect(() => {
    setPlaybackError(null);
    if (!audioQuery.data) {
      setSource(null);
      return;
    }
    const objectUrl = URL.createObjectURL(audioQuery.data);
    setSource(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [audioQuery.data, track?.id]);

  const moveTrack = (offset: -1 | 1) => {
    if (!playlist?.tracks.length) return;
    setTrackIndex((index) => (index + offset + playlist.tracks.length) % playlist.tracks.length);
  };

  return (
    <details className="mt-3 rounded-2xl bg-card p-3 text-left shadow-soft">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold">
        <Music2 className="h-4 w-4 text-primary" aria-hidden />
        Music during workout
        {track && <span className="min-w-0 flex-1 truncate text-xs font-normal">{track.name}</span>}
      </summary>
      {playlistsQuery.isError ? (
        <p role="alert" className="mt-2 text-xs font-bold text-destructive">
          {playlistsQuery.error.message}
        </p>
      ) : playlists.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Import audio and create a playlist in the Workout library first.
        </p>
      ) : !playlist?.tracks.length ? (
        <p className="mt-2 text-xs text-muted-foreground">This playlist has no tracks yet.</p>
      ) : (
        <>
          {playlists.length > 1 && (
            <label className="mt-2 grid gap-1 text-xs font-bold">
              Playlist
              <select
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                value={playlist.id}
                onChange={(event) => {
                  setPlaylistId(event.target.value);
                  setTrackIndex(0);
                }}
              >
                {playlists.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {track?.available === false ? (
            <p role="alert" className="mt-2 text-xs font-bold text-destructive">
              Audio file missing. Re-import this track from the Workout library.
            </p>
          ) : audioQuery.isError ? (
            <p role="alert" className="mt-2 text-xs font-bold text-destructive">
              {audioQuery.error.message}
            </p>
          ) : audioQuery.isPending ? (
            <p className="mt-2 text-xs text-muted-foreground">Loading audio…</p>
          ) : audioQuery.data === null ? (
            <p role="alert" className="mt-2 text-xs font-bold text-destructive">
              Audio file missing. Re-import this track from the Workout library.
            </p>
          ) : !source ? (
            <p className="mt-2 text-xs text-muted-foreground">Loading audio…</p>
          ) : (
            <audio
              key={track?.id}
              className="mt-2 w-full"
              src={source}
              controls
              preload="metadata"
              aria-label={`Play ${track?.name}`}
              onError={() =>
                setPlaybackError(
                  "This browser could not decode the file. Try a supported MP3, M4A, WAV, OGG, or AAC file.",
                )
              }
            />
          )}
          {playbackError && (
            <p role="alert" className="mt-1 text-xs font-bold text-destructive">
              {playbackError}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label="Previous track"
              onClick={() => moveTrack(-1)}
            >
              <ChevronLeft aria-hidden /> Previous
            </Button>
            <span className="min-w-0 flex-1 truncate text-center text-xs text-muted-foreground">
              {track ? `${trackIndex + 1} of ${playlist.tracks.length} · ${track.name}` : ""}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label="Next track"
              onClick={() => moveTrack(1)}
            >
              Next <ChevronRight aria-hidden />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Playback follows browser and device audio-focus behavior and may stop when the app is
            suspended.
          </p>
        </>
      )}
    </details>
  );
}
