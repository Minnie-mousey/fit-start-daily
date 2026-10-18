import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ListMusic, Music2, Plus, Trash2, Upload } from "lucide-react";
import {
  useAddTrackToPlaylist,
  useCreatePlaylist,
  useDeleteAudioTrack,
  useImportAudioTrack,
  useMusicTracks,
  usePlaylists,
  useUpdatePlaylistAction,
} from "@/hooks/use-fitness";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app/Page";

export function PersonalMusicLibrary() {
  const fileInput = useRef<HTMLInputElement>(null);
  const tracksQuery = useMusicTracks();
  const playlistsQuery = usePlaylists();
  const importTrack = useImportAudioTrack();
  const createPlaylist = useCreatePlaylist();
  const addToPlaylist = useAddTrackToPlaylist();
  const deleteTrack = useDeleteAudioTrack();
  const updatePlaylist = useUpdatePlaylistAction();
  const [playlistName, setPlaylistName] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const tracks = tracksQuery.data ?? [];
  const playlists = playlistsQuery.data ?? [];
  const selectedPlaylist =
    playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? playlists[0];

  useEffect(() => {
    if (selectedPlaylist && selectedPlaylist.id !== selectedPlaylistId)
      setSelectedPlaylistId(selectedPlaylist.id);
  }, [selectedPlaylist, selectedPlaylistId]);

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    try {
      for (const file of Array.from(files)) await importTrack.mutateAsync(file);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not import this audio file.");
    }
  };

  const makePlaylist = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      const playlist = await createPlaylist.mutateAsync(playlistName);
      setPlaylistName("");
      setSelectedPlaylistId(playlist.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create this playlist.");
    }
  };

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update your music library.");
    }
  };

  return (
    <Panel className="mt-4">
      <div className="flex items-center gap-2">
        <Music2 className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="font-display text-lg font-semibold">Your music</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Import audio files from this device. Playback depends on your browser's supported formats.
        Audio stays in this browser's local storage and is not backed up with workout data.
      </p>
      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.webm"
        multiple
        aria-label="Choose audio files"
        onChange={(event) => {
          void importFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <Button
        type="button"
        variant="soft"
        size="sm"
        className="mt-3"
        disabled={importTrack.isPending}
        onClick={() => fileInput.current?.click()}
      >
        <Upload aria-hidden /> {importTrack.isPending ? "Importing…" : "Import audio files"}
      </Button>

      <form className="mt-4 flex gap-2" onSubmit={(event) => void makePlaylist(event)}>
        <label className="sr-only" htmlFor="new-playlist-name">
          New playlist name
        </label>
        <input
          id="new-playlist-name"
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
          value={playlistName}
          maxLength={80}
          onChange={(event) => setPlaylistName(event.target.value)}
          placeholder="New playlist"
        />
        <Button type="submit" size="sm" variant="outline" disabled={createPlaylist.isPending}>
          <Plus aria-hidden /> Create
        </Button>
      </form>

      {playlists.length > 0 && (
        <>
          <label className="mt-4 grid gap-1 text-xs font-bold">
            Playlist
            <select
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              value={selectedPlaylist?.id ?? ""}
              onChange={(event) => setSelectedPlaylistId(event.target.value)}
            >
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name} ({playlist.tracks.length})
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 space-y-2">
            {selectedPlaylist?.tracks.map((track, index) => (
              <div
                key={track.id}
                className="flex items-center gap-2 rounded-xl bg-background p-2 text-sm"
              >
                <ListMusic className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1 truncate" title={track.name}>
                  {track.name}
                  {!track.available && (
                    <span className="ml-1 text-xs text-destructive">file missing</span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`Move ${track.name} up`}
                  disabled={index === 0 || updatePlaylist.isPending}
                  className="rounded p-1 disabled:opacity-40"
                  onClick={() =>
                    void run(() =>
                      updatePlaylist.mutateAsync({
                        playlistId: selectedPlaylist.id,
                        trackId: track.id,
                        offset: -1,
                      }),
                    )
                  }
                >
                  <ChevronUp className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${track.name} down`}
                  disabled={
                    index === selectedPlaylist.tracks.length - 1 || updatePlaylist.isPending
                  }
                  className="rounded p-1 disabled:opacity-40"
                  onClick={() =>
                    void run(() =>
                      updatePlaylist.mutateAsync({
                        playlistId: selectedPlaylist.id,
                        trackId: track.id,
                        offset: 1,
                      }),
                    )
                  }
                >
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${track.name} from ${selectedPlaylist.name}`}
                  className="rounded p-1 text-muted-foreground"
                  onClick={() =>
                    void run(() =>
                      updatePlaylist.mutateAsync({
                        playlistId: selectedPlaylist.id,
                        trackId: track.id,
                      }),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
            {selectedPlaylist?.tracks.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Add an imported track to this playlist.
              </p>
            )}
          </div>
        </>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-sm font-bold">Imported tracks ({tracks.length})</p>
        {tracks.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Your imported audio will appear here.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {tracks.map((track) => {
              const isInPlaylist = selectedPlaylist?.tracks.some((item) => item.id === track.id);
              return (
                <li key={track.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate" title={track.name}>
                    {track.name}
                    {!track.available && (
                      <span className="ml-1 text-xs text-destructive">file missing</span>
                    )}
                  </span>
                  {selectedPlaylist && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isInPlaylist || addToPlaylist.isPending}
                      onClick={() =>
                        void run(() =>
                          addToPlaylist.mutateAsync({
                            playlistId: selectedPlaylist.id,
                            trackId: track.id,
                          }),
                        )
                      }
                    >
                      {isInPlaylist ? "Added" : "Add"}
                    </Button>
                  )}
                  <button
                    type="button"
                    aria-label={`Delete ${track.name}`}
                    className="rounded p-1 text-muted-foreground"
                    onClick={() => void run(() => deleteTrack.mutateAsync(track.id))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {(error || tracksQuery.isError || playlistsQuery.isError) && (
        <p role="alert" className="mt-3 text-sm font-bold text-destructive">
          {error ?? tracksQuery.error?.message ?? playlistsQuery.error?.message}
        </p>
      )}
    </Panel>
  );
}
