const PCAChart = (() => {

  // chart dimensions. innerW/innerH are the actual plot area after margins.
  const margin = { top: 20, right: 20, bottom: 55, left: 60 };
  const W = 400, H = 300;
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  // tableau10 is a good default for categorical color — up to 10 distinct regions,
  // reasonably colourblind-friendly.
  let _regionMap = {};
  const colorScale = d3.scaleOrdinal().range(d3.schemeTableau10);

  function countryColor(c) { return colorScale(_regionMap[c] ?? 'Other'); }

  const tooltip = d3.select('#tooltip');

  // show/hide the shared tooltip. We reuse the same element across all charts
  // to avoid z-index fights.
  function showTip(event, html) {
    tooltip.classed('hidden', false).html(html)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 20) + 'px');
  }
  function hideTip() { tooltip.classed('hidden', true); }

  // dot radius: base size when no indicator is selected, scaled by indicator
  // value otherwise. sqrt scale so area (not radius) is proportional to value.
  const BASE_RADIUS = 3;
  const radiusScale = d3.scaleSqrt().range([2.5, 8]);

  function render(pcaData, timeseries, countryRegions) {
    const { countries, pca_coords, explained_variance, year: pcaYear } = pcaData;

    // build a lookup from country name → region for coloring dots.
    _regionMap = countryRegions || {};
    colorScale.domain([...new Set(Object.values(_regionMap))]);

    d3.select('#pca-year-label').text(`PCA year: ${pcaYear}`);

    // flatten the server data into a flat array of objects — easier to work
    // with in D3 selections.
    const data = countries.map((c, i) => ({
      country: c,
      x: pca_coords[i][0],
      y: pca_coords[i][1],
      color: countryColor(c),
    }));

    // add a small padding around the data extents so dots at the edges aren't
    // clipped by the axes.
    const xExt = d3.extent(data, d => d.x);
    const yExt = d3.extent(data, d => d.y);
    const pad = 0.5;
    const xScale = d3.scaleLinear().domain([xExt[0] - pad, xExt[1] + pad]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([yExt[0] - pad, yExt[1] + pad]).range([innerH, 0]);

    const svg = d3.select('#pca-container')
      .append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .on('mouseleave', hideTip)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // grid lines — drawn before the dots so they sit behind everything.
    // tickFormat('') suppresses labels on the grid; the real axes below
    // handle that.
    svg.append('g').attr('class', 'grid')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).tickSize(-innerH).tickFormat(''));
    svg.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(''));

    // axes — kept to 4 ticks each to avoid clutter at this chart size.
    const ev = explained_variance.map(v => (v * 100).toFixed(1));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(4));
    svg.append('g').attr('class', 'axis')
      .call(d3.axisLeft(yScale).ticks(4));

    // axis labels include the % variance explained so users can judge how much
    // information each component captures.
    svg.append('text').attr('class', 'axis-label')
      .attr('x', innerW / 2).attr('y', innerH + 44)
      .attr('text-anchor', 'middle')
      .text(`PC1 (${ev[0]}% variance)`);
    svg.append('text').attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -48)
      .attr('text-anchor', 'middle')
      .text(`PC2 (${ev[1]}% variance)`);

    // brush layer goes in before the dots so dot click events still fire.
    // D3 brush captures pointer events on its overlay, which sits on top —
    // clicks on dots bubble up through the brush before reaching the dot.
    const brushG = svg.append('g').attr('class', 'brush');

    const dots = svg.selectAll('.pca-dot')
      .data(data, d => d.country)
      .join('circle')
      .attr('class', 'pca-dot')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', BASE_RADIUS)
      .attr('fill', d => d.color)
      .attr('opacity', .85);

    // country name labels sit just to the right of each dot. they're hidden
    // or faded when irrelevant via applyDotStyling below.
    const labels = svg.selectAll('.pca-label')
      .data(data, d => d.country)
      .join('text')
      .attr('class', 'pca-label')
      .attr('x', d => xScale(d.x) + 3)
      .attr('y', d => yScale(d.y) + 2)
      .style('pointer-events', 'none');

    // dot interactions: hover shows tooltip and triggers cross-chart highlight,
    // click toggles the country in the selected set (ctrl+click style via
    // the state array).
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
          .style('top', (event.clientY - 10) + 'px');
      })
      .on('mouseout', () => { hideTip(); State.hover(null); })
      .on('click', (event, d) => {
        // toggle this country in/out of the selected array.
        // holding ctrl isn't required — every click appends or removes.
        const current = State.getSelected();
        const currentArr = Array.isArray(current) ? current : (current ? [current] : []);
        const already = currentArr.includes(d.country);
        const next = already
          ? currentArr.filter(c => c !== d.country)
          : [...currentArr, d.country];
        State.select(next);
      });

    // brush handler — collects all dots whose centre falls inside the selection
    // rectangle and pushes them into State as the brushed set. Other charts
    // react to the 'brush' event automatically.
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

    // visual state: dimmed/brushed/selected/hovered classes are applied here
    // whenever shared state changes
    function applyDotStyling() {
      const selected = State.getSelected();
      const selectedSet = new Set(Array.isArray(selected) ? selected : (selected ? [selected] : []));
      const hovered = State.getHovered();
      const brushedSet = new Set(State.getBrushed());
      const brushing = brushedSet.size > 0;

      dots
        .classed('hovered', d => d.country === hovered)
        .classed('selected', d => selectedSet.has(d.country))
        .classed('brushed', d => brushedSet.has(d.country))
        .classed('dimmed', d => {
          if (brushing) return !brushedSet.has(d.country);
          if (selectedSet.size) return !selectedSet.has(d.country);
          return false;
        });

      // labels follow the same logic — fade out anything not in focus.
      labels.attr('opacity', d => {
        if (brushing) return brushedSet.has(d.country) ? 1 : 0.1;
        if (selectedSet.size) return selectedSet.has(d.country) ? 1 : 0.1;
        return 1;
      });
    }

    // resize dots by the currently selected indicator value at the PCA year.
    // if no data exists for a country, fall back to a small fixed radius.
    function applyRadius() {
      const indicator = State.getIndicator();

      if (!indicator) {
        dots.transition().duration(250).attr('r', BASE_RADIUS);
        return;
      }

      const values = {};
      for (const d of data) {
        const ts = timeseries[d.country];
        if (!ts) continue;
        const vals = ts[indicator];
        if (!vals) continue;
        const idx = ts.years.indexOf(pcaYear);
        if (idx < 0) continue;
        const v = vals[idx];
        if (v != null) values[d.country] = v;
      }

      const ext = d3.extent(Object.values(values));
      if (ext[0] == null) {
        dots.transition().duration(250).attr('r', BASE_RADIUS);
        return;
      }
      // guard against all countries having the same value — domain can't be [x, x].
      radiusScale.domain(ext[0] === ext[1] ? [ext[0] - 1, ext[1] + 1] : ext);

      dots.transition().duration(300)
        .attr('r', d => {
          const v = values[d.country];
          return v != null ? radiusScale(v) : 2;
        });
    }

    // show a "PCA data not available" message if the selected country has no
    // PCA coordinates (e.g. it was filtered out during preprocessing).
    function updatePCAMessage() {
      const selected = State.getSelected();
      const selectedArr = Array.isArray(selected) ? selected : (selected ? [selected] : []);
      const selectedSet = new Set(selectedArr);

      const exists = selectedSet.size === 0
        ? true
        : data.some(d => selectedSet.has(d.country));

      d3.select('#pca-message')
        .classed('hidden', exists)
        .text('PCA data not available');
    }

    // wire up state events. 'change' covers selection updates; 'hover' and
    // 'brush' are separate so we don't do unnecessary work on every event.
    State.on('change', applyDotStyling);
    State.on('hover', applyDotStyling);
    State.on('brush', applyDotStyling);
    State.on('indicator', applyRadius);
    State.on('change', () => {
      applyDotStyling();
      updatePCAMessage();
    });

    // region legend — built from the color scale domain so it always stays
    // in sync with whatever regions are present in the data.
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

  return { render };
})();