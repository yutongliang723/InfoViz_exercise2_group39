const PCAChart = (() => {

  const margin = { top: 20, right: 20, bottom: 55, left: 60 };
  const W = 400, H = 300;
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  // Tableau10 is perceptually distinct and colourblind-friendly for up to 10 categories.
  let _regionMap = {};
  const colorScale = d3.scaleOrdinal().range(d3.schemeTableau10);

  function countryColor(c) { return colorScale(_regionMap[c] ?? 'Other'); }

  const tooltip = d3.select('#tooltip');

  function showTip(event, html) {
    tooltip.classed('hidden', false).html(html)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 20) + 'px');
  }
  function hideTip() { tooltip.classed('hidden', true); }

  // Drop anything after the first comma: "Egypt, Arab Rep." -> "Egypt"
  function shortLabel(name) {
    return name.split(',')[0];
  }

  const BASE_RADIUS = 3;
  const radiusScale = d3.scaleSqrt().range([2.5, 8]);

  function render(pcaData, timeseries, countryRegions) {
    const { countries, pca_coords, explained_variance, year: pcaYear } = pcaData;

    _regionMap = countryRegions || {};
    colorScale.domain([...new Set(Object.values(_regionMap))]);

    d3.select('#pca-year-label').text(`PCA year: ${pcaYear}`);

    const data = countries.map((c, i) => ({
      country: c,
      x: pca_coords[i][0],
      y: pca_coords[i][1],
      color: countryColor(c),
    }));

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

    svg.append('g').attr('class', 'grid')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).tickSize(-innerH).tickFormat(''));
    svg.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(''));

    const ev = explained_variance.map(v => (v * 100).toFixed(1));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(4));
    svg.append('g').attr('class', 'axis')
      .call(d3.axisLeft(yScale).ticks(4));

    svg.append('text').attr('class', 'axis-label')
      .attr('x', innerW / 2).attr('y', innerH + 44)
      .attr('text-anchor', 'middle')
      .text(`PC1 (${ev[0]}% variance)`);
    svg.append('text').attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -48)
      .attr('text-anchor', 'middle')
      .text(`PC2 (${ev[1]}% variance)`);

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

    const labels = svg.selectAll('.pca-label')
      .data(data, d => d.country)
      .join('text')
      .attr('class', 'pca-label')
      .attr('x', d => xScale(d.x) + 3)
      .attr('y', d => yScale(d.y) + 2)
      .style('pointer-events', 'none');

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
      // .on('click', (event, d) => State.select(d.country));
      .on('click', (event, d) => {
        const current = State.getSelected();
        const currentArr = Array.isArray(current) ? current : (current ? [current] : []);
        const already = currentArr.includes(d.country);
        const next = already
          ? currentArr.filter(c => c !== d.country)
          : [...currentArr, d.country];
        State.select(next);
      });

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

      labels.attr('opacity', d => {
        if (brushing) return brushedSet.has(d.country) ? 1 : 0.1;
        if (selectedSet.size) return selectedSet.has(d.country) ? 1 : 0.1;
        return 1;
      });
    }

    // PCA coords are fixed to pcaYear; encoding radius against the slider year
    // would mix a moving quantity into a fixed-year view.
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
      radiusScale.domain(ext[0] === ext[1] ? [ext[0] - 1, ext[1] + 1] : ext);

      dots.transition().duration(300)
        .attr('r', d => {
          const v = values[d.country];
          return v != null ? radiusScale(v) : 2;
        });
    }

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

    State.on('change', applyDotStyling);
    State.on('hover', applyDotStyling);
    State.on('brush', applyDotStyling);
    State.on('indicator', applyRadius);
    State.on('change', () => {
                                applyDotStyling();
                                updatePCAMessage();
                              });

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
