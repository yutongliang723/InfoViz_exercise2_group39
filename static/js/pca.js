/**
 * pca.js — Task 2/5/6: 2-D PCA scatterplot with brush + coordinated state.
 *
 * Each dot = one country. Dots:
 *   • Colour   — region (categorical, same palette reused by TS multi-line)
 *   • Radius   — current indicator value at current State.year (encodes Task 6)
 *   • Hover    — tooltip + shared State hover
 *   • Click    — toggles single-country selection
 *   • Brush    — rectangular d3.brush → State.setBrushed(list)
 *
 * Region and country-label data are injected from the server
 * (static/data/regions.json), not hardcoded here.
 */

const PCAChart = (() => {

  const margin = { top: 20, right: 20, bottom: 55, left: 60 };
  const W = 400, H = 300;
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top  - margin.bottom;

  // Region lookup is populated at render() time from server-provided data.
  let _regionMap = {};
  const colorScale = d3.scaleOrdinal()
    .range(d3.schemeTableau10.concat(d3.schemePaired));

  function countryColor(c) { return colorScale(_regionMap[c] ?? 'Other'); }

  const tooltip = d3.select('#tooltip');

  function showTip(event, html) {
    tooltip.classed('hidden', false).html(html)
      .style('left', (event.pageX + 10) + 'px')
      .style('top',  (event.pageY - 20) + 'px');
  }
  function hideTip() { tooltip.classed('hidden', true); }

  // Keep labels short without a hardcoded abbreviation table: drop anything
  // after the first comma (handles World-Bank-style "Egypt, Arab Rep.").
  function shortLabel(name) {
    return name.split(',')[0];
  }

  // Radius scale — redefined on indicator/year change so the range is data-driven.
  const BASE_RADIUS = 3;
  const radiusScale = d3.scaleSqrt().range([2.5, 8]);

  function render(pcaData, timeseries, countryRegions) {
    const { countries, pca_coords, explained_variance, year } = pcaData;

    // Bind region data — derived in backend from static/data/regions.json.
    _regionMap = countryRegions || {};
    colorScale.domain([...new Set(Object.values(_regionMap))]);

    d3.select('#pca-year-label').text(`PCA year: ${year}`);

    const { feature_names } = pcaData;
    const featBox = d3.select('#pca-panel').insert('div', '#pca-container')
      .attr('class', 'features-used');
    featBox.append('span').attr('class', 'features-label').text('Features');
    featBox.append('span').attr('class', 'features-list').text(feature_names.join(' · '));

    const data = countries.map((c, i) => ({
      country: c,
      x: pca_coords[i][0],
      y: pca_coords[i][1],
      color: countryColor(c),
    }));

    const xExt = d3.extent(data, d => d.x);
    const yExt = d3.extent(data, d => d.y);
    const pad  = 0.5;
    const xScale = d3.scaleLinear().domain([xExt[0] - pad, xExt[1] + pad]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([yExt[0] - pad, yExt[1] + pad]).range([innerH, 0]);

    const svg = d3.select('#pca-container')
      .append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`)
        .on('mouseleave', hideTip)
      .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid
    svg.append('g').attr('class', 'grid')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).tickSize(-innerH).tickFormat(''));
    svg.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(''));

    // Axes
    const ev = explained_variance.map(v => (v * 100).toFixed(1));
    svg.append('g').attr('class','axis').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(4));
    svg.append('g').attr('class','axis')
      .call(d3.axisLeft(yScale).ticks(4));

    svg.append('text').attr('class','axis-label')
      .attr('x', innerW / 2).attr('y', innerH + 44)
      .attr('text-anchor','middle')
      .text(`PC1 (${ev[0]}% variance)`);
    svg.append('text').attr('class','axis-label')
      .attr('transform','rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -48)
      .attr('text-anchor','middle')
      .text(`PC2 (${ev[1]}% variance)`);

    // ── Brush layer — above grid/axes, below dots so dot events win ──────
    const brushG = svg.append('g').attr('class', 'brush');

    // ── Dots ────────────────────────────────────────────────────────────
    const dots = svg.selectAll('.pca-dot')
      .data(data, d => d.country)
      .join('circle')
        .attr('class', 'pca-dot')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', BASE_RADIUS)
        .attr('fill', d => d.color)
        .attr('opacity', .85);

    const labels = svg.selectAll('.pca-label')
      .data(data, d => d.country)
      .join('text')
        .attr('class', 'pca-label')
        .attr('x', d => xScale(d.x) + 3)
        .attr('y', d => yScale(d.y) + 2)
        .text(d => shortLabel(d.country))
        .style('pointer-events', 'none');

    // ── Pointer interaction ──────────────────────────────────────────────
    dots
      .on('mouseover', (event, d) => {
        showTip(event,
          `<strong>${d.country}</strong>
           PC1: ${d.x.toFixed(3)}<br>
           PC2: ${d.y.toFixed(3)}<br>
           Region: ${_regionMap[d.country] ?? '—'}`
        );
        State.hover(d.country);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', (event.clientX + 14) + 'px')
          .style('top',  (event.clientY - 10) + 'px');
      })
      .on('mouseout', () => { hideTip(); State.hover(null); })
      .on('click', (event, d) => State.select(d.country));

    // ── Brush → State.setBrushed ────────────────────────────────────────
    function handleBrush(event) {
      if (!event.selection) { State.setBrushed([]); return; }
      const [[x0, y0], [x1, y1]] = event.selection;
      const inside = data
        .filter(d => {
          const cx = xScale(d.x), cy = yScale(d.y);
          return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
        })
        .map(d => d.country);
      State.setBrushed(inside);
    }
    brushG.call(
      d3.brush()
        .extent([[0, 0], [innerW, innerH]])
        .on('start brush end', handleBrush)
    );

    // ── Unified styling — single source of truth for all dot classes ────
    // Driven by any state change. Never re-appends, only toggles classes
    // and transitions attributes.
    function applyDotStyling() {
      const brushedSet = new Set(State.getBrushed());
      const selected   = State.getSelected();
      const hovered    = State.getHovered();
      const brushing   = brushedSet.size > 0;

      dots
        .classed('hovered',  d => d.country === hovered)
        .classed('selected', d => d.country === selected)
        .classed('brushed',  d => brushedSet.has(d.country))
        .classed('dimmed',   d => {
          if (brushing) return !brushedSet.has(d.country);
          if (selected) return d.country !== selected;
          return false;
        });

      labels.attr('opacity', d => {
        if (brushing) return brushedSet.has(d.country) ? 1 : 0.1;
        if (selected) return d.country === selected ? 1 : 0.1;
        return 1;
      });
    }

    // ── Radius encoding — driven by current indicator+year ──────────────
    function applyRadius() {
      const indicator = State.getIndicator();
      const year      = State.getYear();

      if (!indicator || year == null) {
        dots.transition().duration(250).attr('r', BASE_RADIUS);
        return;
      }

      const values = {};
      for (const d of data) {
        const ts = timeseries[d.country];
        if (!ts) continue;
        const vals = ts[indicator];
        if (!vals) continue;
        const idx = ts.years.indexOf(year);
        if (idx < 0) continue;
        const v = vals[idx];
        if (v != null) values[d.country] = v;
      }

      const ext = d3.extent(Object.values(values));
      if (ext[0] == null) {
        dots.transition().duration(250).attr('r', BASE_RADIUS);
        return;
      }
      radiusScale.domain(ext[0] === ext[1] ? [ext[0] - 1, ext[1] + 1] : ext);

      dots.transition().duration(300)
        .attr('r', d => {
          const v = values[d.country];
          return v != null ? radiusScale(v) : 2;
        });
    }

    // ── State subscriptions ─────────────────────────────────────────────
    State.on('change',    applyDotStyling);
    State.on('hover',     applyDotStyling);
    State.on('brush',     applyDotStyling);
    State.on('year',      applyRadius);
    State.on('indicator', applyRadius);

    // ── Legend ──────────────────────────────────────────────────────────
    const legend = d3.select('#pca-legend');
    legend.selectAll('.legend-item')
      .data(colorScale.domain())
      .join('div')
        .attr('class', 'legend-item')
        .each(function (region) {
          const item = d3.select(this);
          item.append('div').attr('class', 'legend-swatch')
            .style('background', colorScale(region));
          item.append('span').text(region);
        });
  }

  return { render, countryColor };
})();
