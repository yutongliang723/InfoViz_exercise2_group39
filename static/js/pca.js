/**
 * pca.js — task 2: 2-D PCA scatterplot.
 *
 * Each dot represents one country. The mapping:
 *   • A label near every dot
 *   • A tooltip on hover showing the country name + PC values
 *   • A colour encoding by region (same palette used in the map)
 *   • Click → selection propagated via shared State
 */

const PCAChart = (() => {

  // ── dimensions ──────────────────────────────────────────────────────────
  const margin = { top: 20, right: 20, bottom: 55, left: 60 };
  const W = 400, H = 300;
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top  - margin.bottom;

  // ── colour scale (one colour per country, grouped by rough region) ──────
  // map each country to a region so nearby countries share a hue group.
  const REGION_MAP = {
    // Europe
    'Albania':'Europe','Austria':'Europe','Bulgaria':'Europe','Croatia':'Europe',
    'Cyprus':'Europe','Czech Republic':'Europe','France':'Europe','Germany':'Europe',
    'Greece':'Europe','Ireland':'Europe','Italy':'Europe','Malta':'Europe',
    'Russian Federation':'Europe','Ukraine':'Europe',
    // Middle East / N Africa
    'Algeria':'MENA','Egypt, Arab Rep.':'MENA','Iran, Islamic Rep.':'MENA',
    'Iraq':'MENA','Jordan':'MENA','Lebanon':'MENA','Morocco':'MENA',
    'Syrian Arab Republic':'MENA','Tunisia':'MENA','Turkey':'MENA',
    // Sub-Saharan Africa
    'Angola':'Africa','Cameroon':'Africa','Eritrea':'Africa','Ethiopia':'Africa',
    'Ghana':'Africa','Kenya':'Africa',
    // South / Central Asia
    'Afghanistan':'S.Asia','Armenia':'S.Asia','Azerbaijan':'S.Asia',
    'India':'S.Asia','Kazakhstan':'S.Asia','Pakistan':'S.Asia',
    // East / SE Asia
    'China':'E.Asia','Indonesia':'E.Asia','Japan':'E.Asia','Philippines':'E.Asia',
    // Americas
    'Argentina':'Americas','Brazil':'Americas','Chile':'Americas',
    'Colombia':'Americas','Cuba':'Americas','Ecuador':'Americas',
    'Mexico':'Americas','Peru':'Americas',
    // Oceania
    'Australia':'Oceania',
  };

  const REGIONS = [...new Set(Object.values(REGION_MAP))];
  const colorScale = d3.scaleOrdinal()
    .domain(REGIONS)
    .range(d3.schemeTableau10.concat(d3.schemePaired));

  function countryColor(c) {
    return colorScale(REGION_MAP[c] ?? 'Other');
  }

  // ── helpers ─────────────────────────────────────────────────────────────
  const tooltip = d3.select('#tooltip');

  function showTip(event, html) {
    tooltip.classed('hidden', false).html(html)
      .style('left', (event.pageX + 10) + 'px')
      .style('top',  (event.pageY - 20) + 'px');
}
  function hideTip() { tooltip.classed('hidden', true); }

  // short label: abbreviate long names
  function shortLabel(name) {
    const abbr = {
      'Russian Federation': 'Russia',
      'Syrian Arab Republic': 'Syria',
      'Iran, Islamic Rep.': 'Iran',
      'Egypt, Arab Rep.': 'Egypt',
      'Czech Republic': 'Czechia',
    };
    return abbr[name] ?? name;
  }

  // ── render ───────────────────────────────────────────────────────────────
  function render(pcaData) {
    const { countries, pca_coords, explained_variance, year } = pcaData;

    d3.select('#pca-year-label').text(`Year: ${year}`);

    // show features used to calculate pca
    const { feature_names } = pcaData;
    d3.select('#pca-panel').insert('p', '#pca-container')
      .attr('class', 'hint')
      .text(`Features used: ${feature_names.join(' · ')}`);

    // build flat data array
    const data = countries.map((c, i) => ({
      country: c,
      x: pca_coords[i][0],
      y: pca_coords[i][1],
      color: countryColor(c),
    }));

    // ── scales ──────────────────────────────────────────────────────────
    const xExt = d3.extent(data, d => d.x);
    const yExt = d3.extent(data, d => d.y);
    const pad  = 0.5;

    const xScale = d3.scaleLinear()
      .domain([xExt[0] - pad, xExt[1] + pad]).range([0, innerW]);
    const yScale = d3.scaleLinear()
      .domain([yExt[0] - pad, yExt[1] + pad]).range([innerH, 0]);

    // ── SVG ─────────────────────────────────────────────────────────────
    const svg = d3.select('#pca-container')
      .append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`)
        .on('mouseleave', hideTip)
      .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
        svg.append('rect')
        .attr('width', innerW)
        .attr('height', innerH)
        .attr('fill', 'transparent')
        .on('mouseover', hideTip);
    // Grid
    svg.append('g').attr('class', 'grid')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).tickSize(-innerH).tickFormat(''));
    svg.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(''));

    // Axes
    const ev = explained_variance.map(v => (v * 100).toFixed(1));
    svg.append('g').attr('class','axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(4));
    svg.append('g').attr('class','axis')
      .call(d3.axisLeft(yScale).ticks(4));

    // Axis labels
    svg.append('text').attr('class','axis-label')
      .attr('x', innerW / 2).attr('y', innerH + 44)
      .attr('text-anchor','middle')
      .text(`PC1 (${ev[0]}% variance)`);
    svg.append('text').attr('class','axis-label')
      .attr('transform','rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -48)
      .attr('text-anchor','middle')
      .text(`PC2 (${ev[1]}% variance)`);

    // ── Dots ────────────────────────────────────────────────────────────
    const dots = svg.selectAll('.pca-dot')
      .data(data, d => d.country)
      .join('circle')
        .attr('class', 'pca-dot')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 3)
        .attr('fill', d => d.color)
        .attr('opacity', .85);

    // ── Labels ──────────────────────────────────────────────────────────
    const labels = svg.selectAll('.pca-label')
      .data(data, d => d.country)
      .join('text')
        .attr('class', 'pca-label')
        .attr('x', d => xScale(d.x) +3)
        .attr('y', d => yScale(d.y) +2)
        .text(d => shortLabel(d.country))
        .style('pointer-events', 'none');
        // .attr('opacity', 0.6);

    // ── Interaction ──────────────────────────────────────────────────────
    dots
      .on('mouseover', (event, d) => {
        showTip(event,
          `<strong>${d.country}</strong>
           PC1: ${d.x.toFixed(3)}<br>
           PC2: ${d.y.toFixed(3)}<br>
           Region: ${REGION_MAP[d.country] ?? '—'}`
        );
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', (event.clientX + 14) + 'px')
          .style('top',  (event.clientY - 10) + 'px');
      })
      .on('mouseout', hideTip)
      .on('click', (event, d) => {
        State.select(d.country);
      });

    // ── React to shared state ────────────────────────────────────────────
    State.on('change', ({ selected }) => {
      dots
        .classed('dimmed',   d => selected && d.country !== selected)
        .classed('selected', d => d.country === selected);
      labels
        .classed('visible', d => d.country === selected)
        .attr('opacity', d => (!selected || d.country === selected) ? 1 : 0);
    });

    // ── Legend ───────────────────────────────────────────────────────────
    const legend = d3.select('#pca-legend');
    REGIONS.forEach(region => {
      const item = legend.append('div').attr('class','legend-item');
      item.append('div').attr('class','legend-swatch')
        .style('background', colorScale(region));
      item.append('span').text(region);
    });
  }

  return { render, countryColor };
})();


