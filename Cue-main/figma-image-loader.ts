"use client"

interface LoaderProps {
  src: string
  width: number
  quality?: number
}

export default function figmaImageLoader({
  src,
  width,
  quality = 75,
}: LoaderProps) {
  if (!src.startsWith("/api/") || !src.includes("/file/")) return src
  const separator = src.includes("?") ? "&" : "?"
  return `${src}${separator}width=${width}&quality=${quality}`
}
