const MapChart = (() => {
  const TOPO_URL = '/static/data/world-topo.json';
  const W = 800, H = 420;

  const DETAIL_COUNT = 8;

  // Sample features evenly across the list rather than just the alphabetic prefix.
  function pickDetailFeatures(features) {
    if (features.length <= DETAIL_COUNT) return features;
    const step = features.length / DETAIL_COUNT;
    return Array.from({ length: DETAIL_COUNT }, (_, i) => features[Math.floor(i * step)]);
  }

  const fmt = d3.format(',.2f');
  const tooltip = d3.select('#tooltip');

  function showTip(event, html) {
    tooltip.classed('hidden', false).html(html)
      .style('left', (event.clientX + 14) + 'px')
      .style('top', (event.clientY - 10) + 'px');
  }
  function moveTip(event) {
    tooltip
      .style('left', (event.clientX + 14) + 'px')
      .style('top', (event.clientY - 10) + 'px');
  }
  function hideTip() { tooltip.classed('hidden', true); }

  function buildTooltipHtml(name, ts, detailFeatures) {
    if (!ts || !ts.years) return `<strong>${name}</strong><div class="muted">No data</div>`;

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

    const idToName = Object.fromEntries(
      Object.entries(countryIds).map(([name, id]) => [id, name])
    );

    countryFeatures.forEach(f => {
      f.properties = f.properties || {};
      f.properties.name_mapped = idToName[f.id] || null;
    });

    const colorScale = d3.scaleSequential(d3.interpolateBlues);
    const projection = d3.geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' });
    const pathGen = d3.geoPath().projection(projection);

    const svg = d3.select('#map-container')
      .append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`);
    svg.on('click', (event) => {
      if (event.target.tagName === 'svg') {
        State.select(null);
      }
    });

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
    // const selectedPath = overlay.append('path').attr('class', 'map-selected');

    // Gradient built once; axis rescaled on domain change.
    const LEGEND_W = 320, LEGEND_H = 18;
    const LEGEND_TOP = 26, LEGEND_BOTTOM = 24;
    const legendSvg = d3.select('#map-legend').append('svg')
      .attr('width', LEGEND_W + 20)
      .attr('height', LEGEND_TOP + LEGEND_H + LEGEND_BOTTOM);
    const legendG = legendSvg.append('g').attr('transform', `translate(10, ${LEGEND_TOP})`);

    const gradientId = 'map-legend-gradient';
    const gradient = legendSvg.append('defs').append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%').attr('x2', '100%');
    d3.range(0, 1.01, 0.1).forEach(t => {
      gradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', d3.interpolateBlues(t));
    });
    legendG.append('rect')
      .attr('width', LEGEND_W).attr('height', LEGEND_H)
      .attr('fill', `url(#${gradientId})`)
      .attr('stroke', '#999').attr('stroke-width', 0.5);
    const legendAxisG = legendG.append('g')
      .attr('class', 'legend-axis')
      .attr('transform', `translate(0, ${LEGEND_H})`);
    const legendTitle = legendG.append('text')
      .attr('class', 'legend-title')
      .attr('x', 0).attr('y', -10)
      .style('fill', '#333');

    const fmtLegend = d3.format('~s');
    function updateLegend(domain, indicator) {
      legendTitle.text(indicator || '');
      if (!domain || domain[0] == null) {
        legendAxisG.selectAll('*').remove();
        return;
      }
      const axisScale = d3.scaleLinear().domain(domain).range([0, LEGEND_W]);
      legendAxisG.transition().duration(250)
        .call(d3.axisBottom(axisScale).ticks(4).tickFormat(fmtLegend));
    }

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
      updateLegend(null, null);
    }

    function refreshColors() {
      const indicator = State.getIndicator();
      const year = State.getYear();
      if (!indicator || year == null) { applyNeutral(); return; }

      const values = collectValues(timeseries, countries, indicator, year);
      const ext = d3.extent(Object.values(values));
      if (ext[0] != null) colorScale.domain(ext);
      applyColors(values, true);
      updateLegend(ext, indicator);
    }

    const detailFeatures = pickDetailFeatures(features);

    paths
      .on('mouseover', (event, d) => {
        const name = d.properties.name_mapped;
        if (!name) return;
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
          if (!name) return;

          const multi = event.ctrlKey || event.metaKey;
          State.select(name, multi);
        })
      .on('click', (event, d) => {
      event.stopPropagation(); 

      const name = d.properties.name_mapped;
      if (!name) return;

      const multi = event.ctrlKey || event.metaKey;
      State.select(name, multi);
    });

    svg.on('mouseleave', hideTip);

    State.on('hover', ({ hovered }) => {
      const f = featureFor(hovered);
      hoverPath.attr('d', f ? pathGen(f) : null);
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
    State.on('change', ({ selected }) => {
        const selectedSet = new Set(selected || []);

        paths
          .classed('selected', d => selectedSet.has(d.properties.name_mapped))
          .classed('dimmed', d => {
            if (selectedSet.size === 0) return false;
            return d.properties.name_mapped && !selectedSet.has(d.properties.name_mapped);
          });
      });
    const select = d3.select('#indicator-select');
    features.forEach(f => select.append('option').attr('value', f).text(f));

    applyNeutral();
  }

  return { render };
})();
