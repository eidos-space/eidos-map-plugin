# Map for Eidos Lite

A React + MapLibre GL JS table view for Eidos Lite.

## Install

This is a preview requiring an Eidos Lite development build with table plugins, host-rendered view configuration and plugin icons. It does not claim compatibility with the currently published stable Lite release.

1. Download `eidos.map-0.1.0.eidos-plugin` from [GitHub Releases](https://github.com/eidos-space/eidos-map-plugin/releases).
2. In Eidos Lite, open **Plugins → Install plugin…** and select the downloaded file.
3. Enable Map in your Space, open an `.eidos` table and choose **New view → Map**.

Optionally download `SHA256SUMS` into the same folder and run `shasum -a 256 -c SHA256SUMS` to check the download. Installation is local; GitHub login is not required. The plugin is installed once on the device and enabled separately for each Space.

Choose latitude and longitude fields in the host toolbar’s **View settings**. Eidos renders the declared schema and saves field IDs per view. Choose a title field for point popups; click a popup to open the host record panel. Zero coordinates are valid; missing and invalid coordinates are excluded and counted.

- Uses the host's current search, filters and sorting.
- Stores field mapping and basemap selection with the saved view, independently for each view.
- Clusters nearby points; click a cluster to zoom in. **Fit all** includes every loaded valid point.
- Online OpenFreeMap Positron is the default basemap. Network errors fall back to bundled Natural Earth outlines, which contain no street-level detail.
- Offline tile downloads and preinstalled detailed map packs are not currently provided. Previously downloaded local data is left untouched but is no longer loaded by this version.
- Map requests expose the viewed geographic area to OpenFreeMap; table rows are not uploaded. Only `https://tiles.openfreemap.org` is declared.
- Loads at most 50,000 matching records in pages of 1,000; the UI discloses truncation. Narrow larger datasets using host filters.
- Record data is read-only. View configuration can be saved when the host permits metadata writes.
- WebGL is required. MapLibre and its worker are bundled; there is no CDN script dependency.

## Development

```sh
npm ci
npm test
npm run pack:plugin
```

Requires Node.js 22 or later. The standalone build emits the standard gzip/JSON `.eidos-plugin` envelope, bundled JavaScript/CSS and `SHA256SUMS` into `dist/`. The SDK import is type-only; React and MapLibre are bundled per plugin. Until the SDK is published, its MIT-licensed type snapshot is included under `vendor/plugin-sdk`. No Eidos repository checkout is needed to build.

## Release

Update `package.json`, `plugin.json` and `RELEASE_NOTES.md` together. Push the release commit to `main`, wait for its build to pass, then create and push the matching lightweight `v<version>` tag. The workflow tests, checks types, packages and publishes a GitHub prerelease with the committed release notes and checksum. Published tags are never moved.

## Credits

- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js): BSD-3-Clause.
- [World Atlas](https://github.com/topojson/world-atlas): ISC; derived from public-domain [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/).
- [OpenFreeMap](https://openfreemap.org/quick_start/), OpenMapTiles and OpenStreetMap contributors: online attribution is displayed by MapLibre.
