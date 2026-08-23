'use client'

export default function CleanPlayer({ embedUrl }) {
  return (
    <div className="relative w-full pb-[56.25%] h-0 overflow-hidden rounded-xl bg-black shadow-lg">
      <iframe
        src={embedUrl}
        className="absolute top-[-55px] left-0 w-full h-[calc(100%+55px)] border-0"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-forms"
        title="Streaming Video Player"
      />
    </div>
  )
}
