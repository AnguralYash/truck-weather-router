import * as maplibregl from 'maplibre-gl'
import type {
  ExpressionSpecification,
  GeoJSONSource,
  LineLayerSpecification,
  MapLayerMouseEvent,
  StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Bundled through Vite so the production build ships the worker next to the app.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef, useState } from 'react'
import { boundsOf, checkpointPopup, checkpointsGeoJSON, routesGeoJSON } from '../mapData'
import { RISK_LEVELS } from '../risk'
import type { Route } from '../types'

maplibregl.setWorkerUrl(workerUrl)

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

/** Used if the background map cannot load: routes and checkpoints still draw. */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#dfe8ec' } }],
}

const SELECTED: ExpressionSpecification = ['==', ['get', 'selected'], 1]

interface Props {
  routes: Route[]
  selectedId: string
  timezone: string
  onSelect: (routeId: string) => void
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function MapView({ routes, selectedId, timezone, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const ready = useRef(false)
  const interacted = useRef(false)
  const actions = useRef<{ addPins: () => void; fit: (animate?: boolean) => void } | null>(null)
  const shownRoutes = useRef(routes)
  const popups = useRef<{ pinned: maplibregl.Popup; hover: maplibregl.Popup } | null>(null)
  const [backgroundFailed, setBackgroundFailed] = useState(false)

  // The data and callbacks the map reads from event handlers and style reloads.
  const latest = useRef({ routes, selectedId, timezone, onSelect })
  useEffect(() => {
    latest.current = { routes, selectedId, timezone, onSelect }
  })

  useEffect(() => {
    if (!container.current) return
    const instance = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: [-96, 38],
      zoom: 3.4,
      attributionControl: { compact: true },
    })
    map.current = instance
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    let usedFallback = false
    // Hovering previews a checkpoint; clicking pins it open (and works on touch screens).
    const pinned = new maplibregl.Popup({ closeButton: true, maxWidth: '260px', offset: 10 })
    const hover = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '260px',
      offset: 10,
      className: 'hover-popup',
    })
    popups.current = { pinned, hover }
    let pins: maplibregl.Marker[] = []

    const sync = () => {
      const { routes: current, selectedId: selected } = latest.current
      const routeSource = instance.getSource('routes') as GeoJSONSource | undefined
      const dotSource = instance.getSource('checkpoints') as GeoJSONSource | undefined
      routeSource?.setData(routesGeoJSON(current, selected))
      dotSource?.setData(checkpointsGeoJSON(current.find((route) => route.id === selected)))
    }

    const addPins = () => {
      pins.forEach((pin) => pin.remove())
      const { routes: current } = latest.current
      const first = current[0]?.checkpoints
      if (!first?.length) return
      const ends = [
        { letter: 'A', point: first[0] },
        { letter: 'B', point: first[first.length - 1] },
      ]
      pins = ends.map(({ letter, point }) => {
        const element = document.createElement('div')
        element.className = 'map-pin'
        element.textContent = letter
        return new maplibregl.Marker({ element }).setLngLat([point.lon, point.lat]).addTo(instance)
      })
    }

    const fit = (animate = true) => {
      const bounds = boundsOf(latest.current.routes)
      if (!bounds) return
      interacted.current = false
      instance.fitBounds(
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        { padding: 70, duration: animate && !prefersReducedMotion() ? 900 : 0, maxZoom: 11 },
      )
    }
    actions.current = { addPins, fit }

    // Once the user pans or zooms, leave the view alone.
    instance.on('dragstart', () => (interacted.current = true))
    instance.on('zoomstart', (event) => {
      if (event.originalEvent) interacted.current = true
    })

    const addLayers = () => {
      if (instance.getSource('routes')) return
      instance.addSource('routes', { type: 'geojson', data: routesGeoJSON([], '') })
      instance.addSource('checkpoints', { type: 'geojson', data: checkpointsGeoJSON(undefined) })
      const line: LineLayerSpecification['layout'] = {
        'line-cap': 'round',
        'line-join': 'round',
        'line-sort-key': ['get', 'selected'],
      }
      instance.addLayer({
        id: 'routes-casing',
        type: 'line',
        source: 'routes',
        layout: line,
        paint: {
          'line-color': '#ffffff',
          'line-width': ['case', SELECTED, 11, 7],
          'line-opacity': ['case', SELECTED, 0.95, 0.6],
        },
      })
      instance.addLayer({
        id: 'routes-line',
        type: 'line',
        source: 'routes',
        layout: line,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', SELECTED, 7, 4],
          'line-opacity': ['case', SELECTED, 1, 0.6],
        },
      })
      instance.addLayer({
        id: 'routes-hit',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#000000', 'line-width': 20, 'line-opacity': 0 },
      })
      instance.addLayer({
        id: 'checkpoints',
        type: 'circle',
        source: 'checkpoints',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 10, 8],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      })
      sync()
    }

    instance.on('style.load', addLayers)
    // Frame the trip as soon as the style is ready; do not wait for every background tile.
    instance.once('style.load', () => {
      ready.current = true
      addPins()
      fit()
    })

    instance.on('error', (event) => {
      // If the background style never loads, fall back to a plain background.
      if (!usedFallback && !instance.isStyleLoaded() && !instance.getSource('routes')) {
        usedFallback = true
        setBackgroundFailed(true)
        instance.setStyle(FALLBACK_STYLE)
        instance.once('style.load', () => {
          ready.current = true
          addPins()
          fit()
        })
      } else {
        console.warn('Map error:', event.error)
      }
    })

    for (const layer of ['routes-hit', 'checkpoints']) {
      instance.on('mouseenter', layer, () => (instance.getCanvas().style.cursor = 'pointer'))
      instance.on('mouseleave', layer, () => (instance.getCanvas().style.cursor = ''))
    }

    const showCheckpoint = (popup: maplibregl.Popup, event: MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      if (!feature) return
      const { routes: current, selectedId: selected, timezone: zone } = latest.current
      const checkpoint = current.find((route) => route.id === selected)?.checkpoints[
        Number(feature.properties.index)
      ]
      if (!checkpoint) return
      popup
        .setLngLat([checkpoint.lon, checkpoint.lat])
        .setDOMContent(checkpointPopup(checkpoint, zone))
        .addTo(instance)
    }

    instance.on('mousemove', 'checkpoints', (event: MapLayerMouseEvent) =>
      showCheckpoint(hover, event),
    )
    instance.on('mouseleave', 'checkpoints', () => hover.remove())
    instance.on('click', 'checkpoints', (event: MapLayerMouseEvent) => {
      hover.remove()
      showCheckpoint(pinned, event)
    })

    // Routes can share a stretch of road. A click on a checkpoint, or on a stretch the
    // selected route already covers, must not switch to the other route underneath.
    instance.on('click', 'routes-hit', (event: MapLayerMouseEvent) => {
      if (instance.queryRenderedFeatures(event.point, { layers: ['checkpoints'] }).length > 0) {
        return
      }
      const ids = (event.features ?? []).map((feature) => feature.properties?.id)
      if (ids.includes(latest.current.selectedId)) return
      const id = ids[0]
      if (typeof id === 'string') latest.current.onSelect(id)
    })

    // The map area changes size while the page animates in; keep the trip in view until the user moves the map.
    const resizer = new ResizeObserver(() => {
      instance.resize()
      if (ready.current && !interacted.current) fit(false)
    })
    resizer.observe(container.current)

    return () => {
      resizer.disconnect()
      pinned.remove()
      hover.remove()
      popups.current = null
      pins.forEach((pin) => pin.remove())
      instance.remove()
      map.current = null
      actions.current = null
      ready.current = false
      interacted.current = false
    }
  }, [])

  // Keep the map in step with the routes and the selection.
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready.current) return
    const routeSource = instance.getSource('routes') as GeoJSONSource | undefined
    const dotSource = instance.getSource('checkpoints') as GeoJSONSource | undefined
    routeSource?.setData(routesGeoJSON(routes, selectedId))
    dotSource?.setData(checkpointsGeoJSON(routes.find((route) => route.id === selectedId)))
    popups.current?.pinned.remove()
    popups.current?.hover.remove()
    // A new plan moves the pins and brings the whole trip back into view.
    if (shownRoutes.current !== routes) {
      shownRoutes.current = routes
      actions.current?.addPins()
      actions.current?.fit()
    }
  }, [routes, selectedId])

  return (
    <div className="map-wrap">
      <div ref={container} className="map-canvas" role="application" aria-label="Route map" />
      <div className="map-legend" aria-label="Checkpoint risk legend">
        <strong>Checkpoint risk</strong>
        <ul>
          {RISK_LEVELS.map((risk) => (
            <li key={risk.name}>
              <i style={{ background: risk.color }} />
              {risk.label}
            </li>
          ))}
        </ul>
      </div>
      {backgroundFailed && (
        <p className="map-note">Background map unavailable. Routes are still shown.</p>
      )}
    </div>
  )
}
