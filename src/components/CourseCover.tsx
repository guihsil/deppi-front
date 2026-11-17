"use client";

import { useState } from "react";

function normalizeCoverUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  return trimmed;
}

export default function CourseCover({
  src,
  alt,
  className = "",
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const resolvedSrc = !hasError ? normalizeCoverUrl(src) : null;

  if (!resolvedSrc) {
    return (
      <div className={`course-cover course-cover-placeholder ${className}`.trim()} aria-label={alt}>
        <span>Sem capa</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={`course-cover ${className}`.trim()}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}
