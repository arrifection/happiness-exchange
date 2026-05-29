import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

export default function MapRecenter({ center, zoom }) {
  const map = useMap()
  const lastCenterRef = useRef('')

  useEffect(() => {
    if (!center || !Array.isArray(center) || center.length < 2) return
    const key = `${center[0]},${center[1]},${zoom}`
    if (lastCenterRef.current === key) return
    lastCenterRef.current = key
    map.setView(center, zoom, { animate: false })
  }, [center, map, zoom])

  return null
}
