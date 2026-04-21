/**
 * map.js — Task 4/5/6: world choropleth + coordinated interactions.
 *
 * Topology source: world-atlas v2 countries-50m (ISO numeric feature IDs).
 * Colour: d3.interpolateViridis at (State.indicator, State.year). No indicator
 * picked → neutral grey. Brush from PCA dims non-brushed project countries.
 * Paths never re-appended; fills are transitioned via selection.transition().
 *
 * Country identification is fully data-driven: the server ships a
 * `country_ids` map (name → padded-3-digit ISO numeric) built from the CSV's
 * Country Code column + an ISO-3166 reference table. No country names are
 * hardcoded in this module.
 */

const MapChart = (() => {
  const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
  const W = 800, H = 420;

  // Curated details-on-demand set — diverse mix across economy, demographics,
  // and land use. Falls back to features.slice(0, 8) if any entry is missing.
  const PREFERRED_DETAIL_FEATURES = [
    'GDP per capita (current US$)',
    'Population, total',
    'Birth rate, crude (per 1,000 people)',
    'Death rate, crude (per 1,000 people)',
    'Mortality rate, infant (per 1,000 live births)',
    'Agricultural land (% of land area)',
    'Forest area (sq. km)',
    'Rural population (% of total population)',
  ];
  function pickDetailFeatures(features) {
    const avail = PREFERRED_DETAIL_FEATURES.filter(f => features.includes(f));
    return avail.length === PREFERRED_DETAIL_FEATURES.length ? avail : features.slice(0, 8);
  }

  const fmt = d3.format(',.2f');
  const tooltip = d3.select('#tooltip');

  function showTip(event, html) {
    tooltip.classed('hidden', false).html(html)
      .style('left', (event.clientX + 14) + 'px')
      .style('top',  (event.clientY - 10) + 'px');
  }
  function moveTip(event) {
    tooltip
      .style('left', (event.clientX + 14) + 'px')
      .style('top',  (event.clientY - 10) + 'px');
  }
  function hideTip() { tooltip.classed('hidden', true); }

  function buildTooltipHtml(name, ts, detailFeatures) {
    if (!ts || !ts.years) return `<strong>${name}</strong><div class="muted">No data</div>`;

    // Year is driven by the slider via State. If the slider value isn't in
    // this country's year list, fall back to the last available year so we
    // never render an empty tooltip.
    const stateYear = State.getYear();
    let idx = ts.years.indexOf(stateYear);
    if (idx < 0) idx = ts.years.length - 1;
    const year = ts.years[idx];

    const rows = detailFeatures.map(f => {
      const v = ts[f] ? ts[f][idx] : null;
      const cell = (v == null || Number.isNaN(v)) ? '—' : fmt(v);
      return `<tr><td class="k">${f}</td><td>${cell}</td></tr>`;
    }).join('');

    return `<strong>${name}</strong> <span class="muted">(${year})</span>
            <table>${rows}</table>`;
  }

  function valueAt(timeseries, country, indicator, year) {
    const ts = timeseries[country];
    if (!ts || !ts[indicator]) return null;
    const idx = ts.years.indexOf(year);
    if (idx < 0) return null;
    const v = ts[indicator][idx];
    return v == null ? null : v;
  }

  function collectValues(timeseries, countries, indicator, year) {
    const out = {};
    for (const country of countries) {
      const v = valueAt(timeseries, country, indicator, year);
      if (v != null) out[country] = v;
    }
    return out;
  }

  async function render({ countries, timeseries, features, countryIds }) {
    const world = await d3.json(TOPO_URL);
    const countryFeatures = topojson.feature(world, world.objects.countries).features;

    // Invert name→id to id→name for topojson feature lookup.
    const idToName = Object.fromEntries(
      Object.entries(countryIds).map(([name, id]) => [id, name])
    );

    countryFeatures.forEach(f => {
      f.properties = f.properties || {};
      f.properties.name_mapped = idToName[f.id] || null;
    });

    const colorScale = d3.scaleSequential(d3.interpolateViridis);
    const projection = d3.geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' });
    const pathGen = d3.geoPath().projection(projection);

    const svg = d3.select('#map-container')
      .append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`);

    const zoomLayer = svg.append('g').attr('class', 'zoom-layer');

    const paths = zoomLayer.selectAll('.country')
      .data(countryFeatures, d => d.id)
      .join('path')
      .attr('class', d => d.properties.name_mapped ? 'country project' : 'country')
      .attr('d', pathGen);

    const overlay = zoomLayer.append('g')
      .attr('class', 'country-overlay')
      .style('pointer-events', 'none');
    const hoverPath = overlay.append('path').attr('class', 'map-hover');
    const selectedPath = overlay.append('path').attr('class', 'map-selected');

    // ── Zoom & pan ─────────────────────────────────────────────────────────
    // translateExtent is in *world* coordinates and scales with the zoom
    // factor automatically, so clamping to [0,0]→[W,H] keeps the map edge
    // from ever leaving the viewport at any zoom level.
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .translateExtent([[0, 0], [W, H]])
      .on('zoom', (event) => zoomLayer.attr('transform', event.transform));
    svg.call(zoom).on('dblclick.zoom', null);

    d3.select('#map-reset-zoom').on('click', () => {
      svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
    });

    function featureFor(name) {
      return name ? countryFeatures.find(f => f.properties.name_mapped === name) : null;
    }

    function applyColors(values, animated = false) {
      const sel = animated ? paths.transition().duration(300) : paths;
      sel.attr('fill', d => {
        const name = d.properties.name_mapped;
        if (!name) return '#eee';
        const val = values[name];
        return val != null ? colorScale(val) : '#ccc';
      });
    }

    function applyNeutral() {
      paths.attr('fill', d => d.properties.name_mapped ? '#c8c8c8' : '#eee');
    }

    function refreshColors() {
      const indicator = State.getIndicator();
      const year = State.getYear();
      if (!indicator || year == null) { applyNeutral(); return; }

      const values = collectValues(timeseries, countries, indicator, year);
      const ext = d3.extent(Object.values(values));
      if (ext[0] != null) colorScale.domain(ext);
      applyColors(values, true);
    }

    // ── Pointer interactions ───────────────────────────────────────────────
    const detailFeatures = pickDetailFeatures(features);

    paths
      .on('mouseover', (event, d) => {
        const name = d.properties.name_mapped;
        if (!name) return;                       // ignore non-project countries
        State.hover(name);
        showTip(event, buildTooltipHtml(name, timeseries[name], detailFeatures));
      })
      .on('mousemove', (event, d) => {
        if (d.properties.name_mapped) moveTip(event);
      })
      .on('mouseout', () => {
        State.hover(null);
        hideTip();
      })
      .on('click', (event, d) => {
        const name = d.properties.name_mapped;
        if (name) State.select(name);
      });

    // Safety net — hide tooltip if the pointer exits the SVG without firing a
    // final path.mouseout (happens with fast diagonal exits).
    svg.on('mouseleave', hideTip);

    // ── State subscriptions ────────────────────────────────────────────────
    State.on('hover', ({ hovered }) => {
      const f = featureFor(hovered);
      hoverPath.attr('d', f ? pathGen(f) : null);
    });

    State.on('change', ({ selected }) => {
      const f = featureFor(selected);
      selectedPath.attr('d', f ? pathGen(f) : null);
    });

    State.on('brush', ({ brushed }) => {
      const set = new Set(brushed);
      const brushing = set.size > 0;
      paths
        .classed('brushed', d => brushing && set.has(d.properties.name_mapped))
        .classed('dimmed', d => brushing && d.properties.name_mapped && !set.has(d.properties.name_mapped));
    });

    State.on('indicator', refreshColors);
    State.on('year', refreshColors);

    // ── Populate indicator select (ownership of the DOM change is in main.js) ─
    const select = d3.select('#indicator-select');
    select.append('option')
      .attr('value', '')
      .attr('disabled', true)
      .attr('selected', true)
      .text('Select an indicator');
    features.forEach(f => select.append('option').attr('value', f).text(f));

    applyNeutral();
  }

  return { render };
})();
