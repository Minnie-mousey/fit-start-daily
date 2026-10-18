import type { Database } from "sql.js";
import type { AudioTrack, Playlist } from "@/lib/types";

export interface AudioFileStore {
  put(id: string, file: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  has(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
}

export interface MusicRepository {
  listTracks(): Promise<AudioTrack[]>;
  getAudio(id: string): Promise<Blob | null>;
  importTrack(file: File): Promise<AudioTrack>;
  deleteTrack(id: string): Promise<void>;
  listPlaylists(): Promise<Playlist[]>;
  createPlaylist(name: string): Promise<Playlist>;
  addToPlaylist(playlistId: string, trackId: string): Promise<void>;
  removeFromPlaylist(playlistId: string, trackId: string): Promise<void>;
  moveTrack(playlistId: string, trackId: string, offset: -1 | 1): Promise<void>;
}

const AUDIO_TYPES: Record<string, string> = {
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  mp4: "audio/mp4",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/opus",
  wav: "audio/wav",
  webm: "audio/webm",
};

type Row = Record<string, unknown>;

function readAll(db: Database, sql: string, params: (string | number)[] = []): Row[] {
  const statement = db.prepare(sql);
  statement.bind(params);
  const rows: Row[] = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

function decodeTrack(row: Row, available: boolean): AudioTrack {
  return {
    id: String(row["id"]),
    name: String(row["name"]),
    mimeType: String(row["mime_type"]),
    sizeBytes: Number(row["size_bytes"]),
    lastModified: Number(row["last_modified"]),
    importedAt: String(row["imported_at"]),
    available,
  };
}

export class SqliteMusicRepository implements MusicRepository {
  constructor(
    private readonly db: Database,
    private readonly persist: (db: Database) => Promise<void>,
    private readonly files: AudioFileStore,
  ) {}

  async listTracks(): Promise<AudioTrack[]> {
    const rows = readAll(
      this.db,
      "SELECT id, name, mime_type, size_bytes, last_modified, imported_at FROM audio_tracks ORDER BY name COLLATE NOCASE, id",
    );
    return Promise.all(
      rows.map(async (row) => decodeTrack(row, await this.files.has(String(row["id"])))),
    );
  }

  getAudio(id: string): Promise<Blob | null> {
    return this.files.get(id);
  }

  async importTrack(file: File): Promise<AudioTrack> {
    const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
    const mimeType = file.type.startsWith("audio/") ? file.type : AUDIO_TYPES[extension];
    if (!mimeType || (!file.type.startsWith("audio/") && !AUDIO_TYPES[extension]))
      throw new Error("Choose an audio file (MP3, M4A, AAC, WAV, OGG, OPUS, FLAC, or WEBM).");
    if (file.size === 0) throw new Error("This audio file is empty.");

    const track: AudioTrack = {
      id: crypto.randomUUID(),
      name: file.name,
      mimeType,
      sizeBytes: file.size,
      lastModified: file.lastModified,
      importedAt: new Date().toISOString(),
      available: true,
    };
    await this.files.put(track.id, file);
    let inserted = false;
    try {
      this.db.run(
        "INSERT INTO audio_tracks (id, name, mime_type, size_bytes, last_modified, imported_at) VALUES (?,?,?,?,?,?)",
        [
          track.id,
          track.name,
          track.mimeType,
          track.sizeBytes,
          track.lastModified,
          track.importedAt,
        ],
      );
      inserted = true;
      await this.persist(this.db);
    } catch (error) {
      if (!inserted) await this.files.delete(track.id);
      throw error;
    }
    return track;
  }

  async deleteTrack(id: string): Promise<void> {
    this.db.run("DELETE FROM audio_tracks WHERE id = ?", [id]);
    await this.persist(this.db);
    await this.files.delete(id);
  }

  async listPlaylists(): Promise<Playlist[]> {
    const rows = readAll(
      this.db,
      "SELECT id, name, created_at FROM playlists ORDER BY created_at, name COLLATE NOCASE",
    );
    const tracks = await this.listTracks();
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return rows.map((row) => ({
      id: String(row["id"]),
      name: String(row["name"]),
      createdAt: String(row["created_at"]),
      tracks: readAll(
        this.db,
        `SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position`,
        [String(row["id"])],
      ).flatMap((entry) => {
        const track = byId.get(String(entry["track_id"]));
        return track ? [track] : [];
      }),
    }));
  }

  async createPlaylist(name: string): Promise<Playlist> {
    const normalized = name.trim();
    if (!normalized) throw new Error("Enter a playlist name.");
    if (normalized.length > 80) throw new Error("Playlist names must be 80 characters or fewer.");
    const playlist: Playlist = {
      id: crypto.randomUUID(),
      name: normalized,
      createdAt: new Date().toISOString(),
      tracks: [],
    };
    this.db.run("INSERT INTO playlists (id, name, created_at) VALUES (?,?,?)", [
      playlist.id,
      playlist.name,
      playlist.createdAt,
    ]);
    await this.persist(this.db);
    return playlist;
  }

  async addToPlaylist(playlistId: string, trackId: string): Promise<void> {
    const [row] = readAll(
      this.db,
      "SELECT COUNT(*) AS count FROM playlist_tracks WHERE playlist_id = ?",
      [playlistId],
    );
    this.db.run("INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?,?,?)", [
      playlistId,
      trackId,
      Number(row?.["count"] ?? 0),
    ]);
    await this.persist(this.db);
  }

  async removeFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    const ids = this.getTrackIds(playlistId).filter((id) => id !== trackId);
    await this.writeOrder(playlistId, ids);
  }

  async moveTrack(playlistId: string, trackId: string, offset: -1 | 1): Promise<void> {
    const ids = this.getTrackIds(playlistId);
    const from = ids.indexOf(trackId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    await this.writeOrder(playlistId, ids);
  }

  private getTrackIds(playlistId: string): string[] {
    return readAll(
      this.db,
      "SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position",
      [playlistId],
    ).map((row) => String(row["track_id"]));
  }

  private async writeOrder(playlistId: string, trackIds: string[]): Promise<void> {
    this.db.run("BEGIN TRANSACTION");
    try {
      this.db.run("DELETE FROM playlist_tracks WHERE playlist_id = ?", [playlistId]);
      trackIds.forEach((trackId, position) =>
        this.db.run(
          "INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?,?,?)",
          [playlistId, trackId, position],
        ),
      );
      this.db.run("COMMIT");
      await this.persist(this.db);
    } catch (error) {
      try {
        this.db.run("ROLLBACK");
      } catch {
        // The transaction may already have committed.
      }
      throw error;
    }
  }
}
