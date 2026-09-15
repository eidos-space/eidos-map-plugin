Map 0.1.0 is the first preview of the MapLibre-based table view for Eidos Lite.

- Display table records using latitude and longitude fields, with clusters and record popups.
- Configure field mappings and basemap through the host's View settings.
- Use current table search, filters and sorting; each view stores its own configuration.
- Online OpenFreeMap basemap with bundled world-outline fallback and a theme-aware plugin icon.

Requires an Eidos Lite development build supporting table plugins, configuration schemas and plugin icons. Compatibility with the currently published stable Lite release is not claimed.

Download `eidos.map-0.1.0.eidos-plugin` and choose **Plugins → Install plugin…**, then enable Map in your Space. Open an `.eidos` table and add a Map view. Select latitude and longitude fields in **View settings**.

The plugin reads at most 50,000 matching records. Detailed offline tiles are not included. Online maps connect to OpenFreeMap; record data is not uploaded. `SHA256SUMS` provides the asset checksum.
