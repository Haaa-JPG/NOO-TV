'use client'

import { useState } from 'react'

export default function CleanPlayer({ embedUrl }) {
  const [clicked, setClicked] = useState(false)

  return (
    <div className="relative w-full pb-[56.25%] h-0 overflow-hidden rounded-xl bg-black shadow-lg">
      <iframe
        src={embedUrl}
        className="absolute top-[-55px] left-0 w-full h-[calc(100%+55px)] border-0"
        allowFullScreen
        title="Streaming Video Player"
      />
      {!clicked && (
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={() => setClicked(true)}
        />
      )}
    </div>
  )
}
