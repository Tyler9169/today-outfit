"use client";
import { useEffect, useRef } from "react";
export function Photo({ photo, alt, className }: { photo: Blob; alt: string; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => { const url = URL.createObjectURL(photo); if (ref.current) ref.current.src = url; return () => URL.revokeObjectURL(url); }, [photo]);
  // User-selected blobs cannot be optimized by the server.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt={alt} className={className} />;
}
