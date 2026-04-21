/**
 * map.js — Task 4/5: world choropleth + coordinated interactions.
 *
 * Topology source: world-atlas v2 countries-110m (ISO numeric feature IDs).
 * Project countries filled via d3.interpolateViridis; all others: #eee.
 * Indicator changes update fills via transition — paths are never re-appended.
 * Hover/click emit to shared State; map reacts to State hover from PCA.
 */

const MapChart = (() => {
  const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';

  // World Bank name → ISO 3166-1 numeric (matches topojson feature .id)
  const NAME_TO_ID = {
    'Afghanistan': 4, 'Albania': 8, 'Algeria': 12, 'Angola': 24,
    'Argentina': 32, 'Armenia': 51, 'Australia': 36, 'Austria': 40,
    'Azerbaijan': 31, 'Brazil': 76, 'Bulgaria': 100, 'Cameroon': 120,
    'Chile': 152, 'China': 156, 'Colombia': 170, 'Croatia': 191,
    'Cuba': 192, 'Cyprus': 196, 'Czech Republic': 203, 'Ecuador': 218,
    'Egypt, Arab Rep.': 818, 'Eritrea': 232, 'Ethiopia': 231,
    'France': 250, 'Germany': 276, 'Ghana': 288, 'Greece': 300,
    'India': 356, 'Indonesia': 360, 'Iran, Islamic Rep.': 364,
    'Iraq': 368, 'Ireland': 372, 'Italy': 380, 'Japan': 392,
    'Jordan': 400, 'Kazakhstan': 398, 'Kenya': 404, 'Lebanon': 422,
    'Malta': 470, 'Mexico': 484, 'Morocco': 504, 'Pakistan': 586,
    'Peru': 604, 'Philippines': 608, 'Russian Federation': 643,
    'Syrian Arab Republic': 760, 'Tunisia': 788, 'Turkey': 792, 'Ukraine': 804,
  };

  // topojson feature .id is a zero-padded 3-digit string ("008", "076") — pad
  // our numeric values to match, otherwise lookups fail for codes < 100.
  const ID_TO_NAME = Object.fromEntries(
    Object.entries(NAME_TO_ID).map(([name, id]) => [String(id).padStart(3, '0'), name])
  );

  const W = 800, H = 420;

  function getMostRecentValues(timeseries, countries, indicator) {
    const out = {};
    for (const country of countries) {
      const ts = timeseries[country];
      if (!ts) continue;
      const vals = ts[indicator];
      if (!vals) continue;
      for (let i = ts.years.length - 1; i >= 0; i--) {
        if (vals[i] != null) { out[country] = vals[i]; break; }
      }
    }
    return out;
  }

  async function render({ countries, timeseries, features }) {
    const world = await d3.json(TOPO_URL);
    const countryFeatures = topojson.feature(world, world.objects.countries).features;

    // Annotate each feature with the World Bank name so event handlers can use
    // d.properties.name_mapped directly without a second lookup.
    countryFeatures.forEach(f => {
      f.properties = f.properties || {};
      f.properties.name_mapped = ID_TO_NAME[f.id] || null;
    });

    const colorScale = d3.scaleSequential(d3.interpolateViridis);

    const projection = d3.geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' });
    const pathGen = d3.geoPath().projection(projection);

    const svg = d3.select('#map-container')
      .append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`);

    // All geometry lives inside the zoom layer so pan/zoom transforms it as
    // one unit. vector-effect: non-scaling-stroke (CSS) keeps strokes crisp.
    const zoomLayer = svg.append('g').attr('class', 'zoom-layer');

    // Enter once — never re-appended on indicator or state change.
    const paths = zoomLayer.selectAll('.country')
      .data(countryFeatures, d => d.id)
      .join('path')
      .attr('class', d => d.properties.name_mapped ? 'country project' : 'country')
      .attr('d', pathGen);

    // Overlay above all fills so highlight strokes are never occluded by
    // neighbouring countries' fills (which would clip shared borders).
    const overlay = zoomLayer.append('g')
      .attr('class', 'country-overlay')
      .style('pointer-events', 'none');
    const hoverPath = overlay.append('path').attr('class', 'map-hover');
    const selectedPath = overlay.append('path').attr('class', 'map-selected');

    // ── Zoom & pan ─────────────────────────────────────────────────────────
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event) => zoomLayer.attr('transform', event.transform));
    svg.call(zoom).on('dblclick.zoom', null); // disable default dblclick-zoom-in

    d3.select('#map-reset-zoom').on('click', () => {
      svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
    });

    function featureFor(name) {
      return name ? countryFeatures.find(f => f.properties.name_mapped === name) : null;
    }

    function applyColors(values, animated = false) {
      const sel = animated ? paths.transition().duration(400) : paths;
      sel.attr('fill', d => {
        const name = d.properties.name_mapped;
        if (!name) return '#eee';
        const val = values[name];
        return val != null ? colorScale(val) : '#ccc';
      });
    }

    // Before any indicator is picked: distinguish project countries (clickable)
    // from the rest with a neutral tone rather than the full viridis scale.
    function applyNeutral() {
      paths.attr('fill', d => d.properties.name_mapped ? '#c8c8c8' : '#eee');
    }

    // ── Interactions ───────────────────────────────────────────────────────
    paths
      .on('mouseover', (event, d) => {
        const name = d.properties.name_mapped;
        if (name) State.hover(name);
      })
      .on('mouseout', () => State.hover(null))
      .on('click', (event, d) => {
        const name = d.properties.name_mapped;
        if (name) State.select(name);
      });

    // ── React to shared state ──────────────────────────────────────────────
    // Highlights are drawn on the overlay — never on the country paths — so the
    // full border renders regardless of neighbour fill ordering.
    State.on('hover', ({ hovered }) => {
      const f = featureFor(hovered);
      hoverPath.attr('d', f ? pathGen(f) : null);
    });

    State.on('change', ({ selected }) => {
      const f = featureFor(selected);
      selectedPath.attr('d', f ? pathGen(f) : null);
    });

    // ── Indicator select ───────────────────────────────────────────────────
    const select = d3.select('#indicator-select');

    // Disabled placeholder — first & default option so the user has to make
    // an explicit choice. Because it's disabled they can't return to it.
    select.append('option')
      .attr('value', '')
      .attr('disabled', true)
      .attr('selected', true)
      .text('— Select an indicator —');

    features.forEach(f => select.append('option').attr('value', f).text(f));

    // Initial render: no indicator chosen yet.
    applyNeutral();

    select.on('change', function () {
      if (!this.value) { applyNeutral(); return; }
      const values = getMostRecentValues(timeseries, countries, this.value);
      colorScale.domain(d3.extent(Object.values(values)));
      applyColors(values, true);
    });
  }

  return { render };
})();
