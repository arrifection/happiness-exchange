import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

export default function MapRecenter({ center, zoom }) {
  const map = useMap()

  useEffect(() => {
    if (!center) return
    map.setView(center, zoom, { animate: true })
  }, [center, map, zoom])

  return null
}
