import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getPlaybackPosition,
  getVideoObjectUrl,
  savePlaybackPosition,
} from "../services/library";

interface MoviePlayerProps {
  movie: {
    title: string;
    relativePath: string;
    posterUrl?: string;
  };
}

export function MoviePlayer({ movie }: MoviePlayerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedAt = useRef(0);
  const resumeAt = useRef(0);
  const [started, setStarted] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void getVideoObjectUrl(movie.relativePath)
      .then((url) => {
        if (controller.signal.aborted) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setVideoUrl(url);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : t("playbackUnsupported"));
        }
      });
    void getPlaybackPosition(movie.relativePath)
      .then((position) => {
        if (controller.signal.aborted) return;
        resumeAt.current = position;
        setPlaybackPosition(position);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(t("playbackProgressUnavailable"));
      });
    return () => {
      controller.abort();
      if (objectUrl?.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
    };
  }, [movie.relativePath, t]);

  async function persistPosition(position: number) {
    if (!Number.isFinite(position) || position < 0) return;
    try {
      await savePlaybackPosition(movie.relativePath, position);
      setPlaybackPosition(position);
    } catch {
      setError(t("playbackProgressUnavailable"));
    }
  }

  function startPlayback() {
    const video = videoRef.current;
    if (!video) return;
    setError("");
    setStarted(true);
    void video.play().catch(() => setError(t("playbackUnsupported")));
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || video.currentTime - lastSavedAt.current < 10) return;
    lastSavedAt.current = video.currentTime;
    void persistPosition(video.currentTime);
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    const position = resumeAt.current;
    video.currentTime =
      position > 0 && position < video.duration - 15
        ? position
        : 0;
  }

  return (
    <section aria-label={t("moviePlayer", { title: movie.title })} className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-zinc-800 bg-black">
        <video
          ref={videoRef}
          src={videoUrl || undefined}
          poster={movie.posterUrl}
          controls
          playsInline
          preload="metadata"
          aria-label={t("moviePlayer", { title: movie.title })}
          className="h-full w-full"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPause={() => {
            const video = videoRef.current;
            if (video && !video.ended) void persistPosition(video.currentTime);
          }}
          onEnded={() => {
            lastSavedAt.current = 0;
            void persistPosition(0);
          }}
          onError={() => setError(t("playbackUnsupported"))}
        />
        {!started && (
          <button
            type="button"
            onClick={startPlayback}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 text-center outline-none transition hover:bg-black/35 focus-visible:ring-4 focus-visible:ring-red-500"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-red-600 text-2xl text-white shadow-xl">
              ▶
            </span>
            <span className="font-bold text-white">
              {playbackPosition > 0
                ? t("resumeMovie", { time: formatTime(playbackPosition) })
                : t("playMovie")}
            </span>
          </button>
        )}
      </div>
      <p className="text-sm text-zinc-400">
        {t("playbackHint")}
      </p>
      {error && (
        <p role="status" className="rounded-lg bg-amber-950/50 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      )}
    </section>
  );
}

function formatTime(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const remainder = Math.floor(seconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}
