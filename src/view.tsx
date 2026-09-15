import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import * as maplibregl from "maplibre-gl"
import {
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl"
import { feature, mesh } from "topojson-client"
import type { Topology, GeometryCollection } from "topojson-specification"
import countries from "world-atlas/countries-110m.json"
import type {
  Mount,
  TableContext,
  TableViewSnapshot,
} from "@eidos.space/plugin-sdk"
import { coordinate, longitudeBounds, unwrapRing } from "./coordinates"
import "maplibre-gl/dist/maplibre-gl.css"
import "./style.css"
import workerSource from "./generated/maplibre-worker"

// Keep workers self-contained in the plugin sandbox; no CDN or sibling files.
// MapLibre selects classic workers for .cjs URLs. The fragment preserves the
// Blob URL while avoiding module-worker origin restrictions in opaque iframes.
maplibregl.setWorkerUrl(`${URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }))}#.cjs`)

type Config = {
  latitude: string
  longitude: string
  label: string
  basemap: "offline" | "online"
}
type Point = GeoJSON.Feature<GeoJSON.Point, { id: string; label: string }>
const land = feature(
  countries as unknown as Topology<{ countries: GeometryCollection }>,
  (countries as unknown as Topology<{ countries: GeometryCollection }>).objects
    .countries
)
for (const country of land.features) {
  // The south-pole ring intentionally covers all longitudes.
  if (
    (country.properties as Record<string, unknown> | null)?.name ===
    "Antarctica"
  )
    continue
  if (country.geometry.type === "Polygon")
    country.geometry.coordinates = country.geometry.coordinates.map(unwrapRing)
  if (country.geometry.type === "MultiPolygon")
    country.geometry.coordinates = country.geometry.coordinates.map((polygon) =>
      polygon.map(unwrapRing)
    )
}
const borders = mesh(
  countries as unknown as Topology<{ countries: GeometryCollection }>,
  (countries as unknown as Topology<{ countries: GeometryCollection }>).objects
    .countries,
  (a, b) => a !== b
)
function offlineStyle(): StyleSpecification {
  const dark =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--eidos-color-scheme")
      .trim() === "dark"
  return {
    version: 8,
    sources: {
      land: {
        type: "geojson",
        data: land,
        attribution: "Natural Earth · Public domain",
      },
      borders: { type: "geojson", data: borders },
    },
    layers: [
      {
        id: "water",
        type: "background",
        paint: { "background-color": dark ? "#20282d" : "#e5edf0" },
      },
      {
        id: "land",
        type: "fill",
        source: "land",
        paint: { "fill-color": dark ? "#333937" : "#f4f2ec" },
      },
      {
        id: "borders",
        type: "line",
        source: "borders",
        paint: {
          "line-color": dark ? "#535b56" : "#ced1c8",
          "line-width": 0.5,
        },
      },
    ],
  }
}
function initialConfig(snapshot: TableViewSnapshot): Config {
  const saved = snapshot.view.properties?.plugin as Partial<Config> | undefined
  return {
    latitude: saved?.latitude ?? "",
    longitude: saved?.longitude ?? "",
    label: saved?.label ?? "",
    basemap: saved?.basemap === "offline" ? "offline" : "online",
  }
}
function MapView({ table }: { table: TableContext }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const popup = useRef<maplibregl.Popup | null>(null)
  const data = useRef<Point[]>([])
  const [snapshot, setSnapshot] = useState<TableViewSnapshot | null>(null)
  const [config, setConfig] = useState<Config>({
    latitude: "",
    longitude: "",
    label: "",
    basemap: "online",
  })
  const [points, setPoints] = useState<Point[]>([])
  const [skipped, setSkipped] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [revision, setRevision] = useState(0)
  const fitted = useRef(false)
  const report = (cause: unknown) =>
    setError(cause instanceof Error ? cause.message : String(cause))
  useEffect(() => {
    const observation = table.observe(() => setRevision((value) => value + 1))
    return () => observation.dispose()
  }, [table])
  useEffect(() => {
    let active = true
    void table
      .read()
      .then((value) => {
        if (active) {
          setSnapshot(value)
          setConfig(initialConfig(value))
        }
      })
      .catch((cause) => {
        if (active) report(cause)
      })
    return () => {
      active = false
    }
  }, [table, revision])
  useEffect(() => {
    if (!snapshot || !config.latitude || !config.longitude) {
      setPoints([])
      return
    }
    let active = true
    const fields = snapshot.fields
    const lat = fields.find((field) => field.id === config.latitude)
    const lon = fields.find((field) => field.id === config.longitude)
    const label = fields.find((field) => field.id === config.label)
    const id = fields.find((field) => field.type === "row-id")
    if (!lat || !lon || !id) {
      setPoints([])
      return
    }
    void (async () => {
      const result: Point[] = []
      let invalid = 0,
        count = 0
      for (let offset = 0; offset < 50000; offset += 1000) {
        const page = await table.getPage({ offset, limit: 1000 })
        if (!active) return
        count = page.total
        for (const row of page.rows) {
          const latitude = coordinate(row[lat.tableColumnName], 90)
          const longitude = coordinate(row[lon.tableColumnName], 180)
          if (latitude === null || longitude === null) {
            invalid++
            continue
          }
          const rowId = String(row[id.tableColumnName])
          result.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [longitude, latitude] },
            properties: {
              id: rowId,
              label: label ? String(row[label.tableColumnName] ?? "") : rowId,
            },
          })
        }
        if (!page.rows.length || offset + page.rows.length >= count) break
      }
      if (active) {
        setPoints(result)
        setSkipped(invalid)
        setTotal(count)
        setError("")
      }
    })().catch((cause) => {
      if (active) report(cause)
    })
    return () => {
      active = false
    }
  }, [table, snapshot, config.latitude, config.longitude, config.label])
  function fit() {
    const value = data.current
    if (!map.current || !value.length) return
    const [west, east] = longitudeBounds(
      value.map((point) => point.geometry.coordinates[0]!)
    )
    let south = 90,
      north = -90
    for (const point of value) {
      south = Math.min(south, point.geometry.coordinates[1]!)
      north = Math.max(north, point.geometry.coordinates[1]!)
    }
    map.current.fitBounds(
      [
        [west, Math.max(-85, south)],
        [east, Math.min(85, north)],
      ],
      { padding: 60, maxZoom: 13, duration: 0 }
    )
  }
  useEffect(() => {
    if (!container.current) return
    let instance: maplibregl.Map
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: offlineStyle(),
        center: [0, 25],
        zoom: 1.5,
        attributionControl: { compact: true },
      })
    } catch (cause) {
      report(cause)
      return
    }
    map.current = instance
    instance.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    )
    instance.on("style.load", () => {
      instance.addSource("records", {
        type: "geojson",
        data: { type: "FeatureCollection", features: data.current },
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 14,
      })
      instance.addLayer({
        id: "clusters",
        type: "circle",
        source: "records",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#38869a",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            14,
            100,
            20,
            1000,
            26,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      })
      instance.addLayer({
        id: "points",
        type: "circle",
        source: "records",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#247c91",
          "circle-radius": 6,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      })
    })
    instance.on("click", "clusters", (event) => {
      const selected = event.features?.[0]
      if (!selected || selected.geometry.type !== "Point") return
      const center = selected.geometry.coordinates as [number, number]
      void (instance.getSource("records") as GeoJSONSource)
        .getClusterExpansionZoom(Number(selected.properties.cluster_id))
        .then((zoom) => {
          if (map.current === instance)
            instance.easeTo({ center, zoom, duration: 0 })
        })
        .catch(report)
    })
    instance.on("click", "points", (event) => {
      const selected = event.features?.[0]
      if (!selected || selected.geometry.type !== "Point") return
      popup.current?.remove()
      const button = document.createElement("button")
      button.className = "record-link"
      button.textContent = String(selected.properties.label || "Open record")
      button.addEventListener("click", () => {
        void table.openRecord(String(selected.properties.id)).catch(report)
      })
      popup.current = new maplibregl.Popup({ closeOnClick: true })
        .setLngLat(selected.geometry.coordinates as [number, number])
        .setDOMContent(button)
        .addTo(instance)
    })
    for (const layer of ["points", "clusters"]) {
      instance.on("mouseenter", layer, () => {
        instance.getCanvas().style.cursor = "pointer"
      })
      instance.on("mouseleave", layer, () => {
        instance.getCanvas().style.cursor = ""
      })
    }
    const resize = new ResizeObserver(() => instance.resize())
    resize.observe(container.current)
    return () => {
      resize.disconnect()
      popup.current?.remove()
      instance.remove()
      map.current = null
    }
  }, [table])
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    let failed = false
    setNotice("")
    const localStyle = offlineStyle
    const fallback = () => {
      if (failed || config.basemap !== "online") return
      failed = true
      setNotice("Online basemap unavailable · showing world outline")
      instance.setStyle(localStyle())
    }
    instance.on("error", fallback)
    instance.setStyle(
      config.basemap === "online"
        ? "https://tiles.openfreemap.org/styles/positron"
        : localStyle()
    )
    const deadline = setTimeout(() => {
      if (!instance.isStyleLoaded()) fallback()
    }, 10000)
    const theme = new MutationObserver(() => {
      if (config.basemap === "offline" || failed)
        instance.setStyle(localStyle())
    })
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    })
    return () => {
      clearTimeout(deadline)
      instance.off("error", fallback)
      theme.disconnect()
    }
  }, [config.basemap])
  useEffect(() => {
    data.current = points
    const source = map.current?.getSource("records") as
      | GeoJSONSource
      | undefined
    source?.setData({ type: "FeatureCollection", features: points })
    if (points.length && !fitted.current) {
      fitted.current = true
      fit()
    }
  }, [points])
  const configured =
    snapshot?.fields.some((field) => field.id === config.latitude) &&
    snapshot?.fields.some((field) => field.id === config.longitude)
  return (
    <main>
      <div className="canvas">
        <div ref={container} className="map" />
        <button className="fit-control" disabled={!points.length} onClick={fit}>
          Fit all
        </button>
        <div className="map-messages">
          {error && (
            <div className="message" role="alert">
              {error}
              <button onClick={() => setRevision((value) => value + 1)}>
                Retry
              </button>
            </div>
          )}
          {notice && (
            <div className="message" role="status">
              {notice}
            </div>
          )}
          {total > 50000 && (
            <div className="message">
              Showing the first 50,000 matching records. Use filters to narrow
              the map.
            </div>
          )}
          {skipped > 0 && (
            <div className="message">
              {skipped} records without valid coordinates
            </div>
          )}
        </div>
        {!configured && (
          <p className="empty">
            Choose latitude and longitude fields in the host’s View settings.
          </p>
        )}
      </div>
    </main>
  )
}
const mount: Mount = (ctx, element) => {
  if (ctx.binding.kind !== "table") throw new Error("Map requires a table view")
  const root = createRoot(element)
  root.render(<MapView table={ctx.binding.table} />)
  return { dispose: () => root.unmount() }
}
export default mount
