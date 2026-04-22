/**
 * timeseries.js — Task 5/6: coordinated time-series line chart.
 *
 * Data is driven by shared State:
 *   • brushed (PCA brush) non-empty → one line per brushed country
 *   • otherwise selected               → single line
 *   • otherwise                        → placeholder hint
 *
 * Multi-line mode renders a below-chart legend (country name + region
 * swatch) instead of inline labels, to avoid overlap. Hover on either a
 * line or a legend entry highlights the pair and shows a tooltip with
 * the value at the current State.year.
 *
 * The chart scaffold (axes, line group, year line, legend container) is
 * built once; updates use keyed data-joins.
 */

const TimeSeriesChart = (() => {
  const margin = { top: 20, right: 20, bottom: 50, left: 65 };
  const W = 500, H = 300;
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top  - margin.bottom;

  const xScale = d3.scaleLinear().range([0, innerW]);
  const yScale = d3.scaleLinear().range([innerH, 0]);

  const lineGen = d3.line()
    .defined(d => d.value != null)
    .x(d => xScale(d.year))
    .y(d => yScale(d.value));

  // Per-country categorical scale scoped to this chart. PCAChart colours by
  // region (correct for showing region clusters in the scatter), but reusing
  // it here would collapse all lines to a single hue whenever the selected
  // set happens to come from one region. d3.quantize over interpolateRainbow
  // gives a distinct hue for every country in the full project set, so
  // uniqueness holds for any subset the user brushes.
  const _tsColor = d3.scaleOrdinal();

  // Module state, wired in render().
  let _timeseries = null;
  let _xAxisG, _yAxisG, _hintText, _lineGroup, _yearLine, _yLabel, _legend, _legendHint;

  // Country → points[], refreshed on each update(); used by the tooltip.
  const _pointsByCountry = new Map();

  const tooltip = d3.select('#tooltip');

  // ── Data helpers ──────────────────────────────────────────────────────
  function seriesFor(country, indicator) {
    const ts = _timeseries[country];
    if (!ts) return null;
    const vals = ts[indicator];
    if (!vals) return null;
    const points = ts.years.map((yr, i) => ({ year: yr, value: vals[i] ?? null }));
    return { country, points };
  }

  // ── Shared interaction helpers (defined once, not per update) ────────
  function highlight(country) {
    _lineGroup.selectAll('.ts-line')
      .classed('faded',       d => country && d.country !== country)
      .classed('highlighted', d => d.country === country);
    _legend.selectAll('.legend-item')
      .classed('faded',       d => country && d.country !== country)
      .classed('highlighted', d => d.country === country);
  }

  function showTip(event, country) {
    const points = _pointsByCountry.get(country);
    const yr = State.getYear();
    const atYear = points?.find(p => p.year === yr);
    const valTxt = atYear?.value != null ? atYear.value.toPrecision(4) : '—';
    tooltip.classed('hidden', false)
      .html(`<strong>${country}</strong><br>${yr ?? ''}: ${valTxt}`)
      .style('left', (event.clientX + 14) + 'px')
      .style('top',  (event.clientY - 10) + 'px');
  }
  function hideTip() { tooltip.classed('hidden', true); }

  // Attached to both lines and legend items so hover works from either side.
  const hoverHandlers = {
    mouseover: (event, d) => { highlight(d.country); showTip(event, d.country); },
    mousemove: (event, d) => showTip(event, d.country),
    mouseout:  ()          => { highlight(null); hideTip(); },
  };

  // ── Rendering sub-routines ───────────────────────────────────────────
  function clearPlot(hintMessage) {
    _lineGroup.selectAll('.ts-line').remove();
    _legend.selectAll('.legend-item').remove();
    _legendHint.selectAll('p').remove();
    _yearLine.attr('display', 'none');
    _hintText.style('display', null).text(hintMessage);
    _pointsByCountry.clear();
    d3.select('#ts-country').text('');
  }

  function updateLines(series, multi) {
    const lines = _lineGroup.selectAll('.ts-line')
      .data(series, d => d.country);

    lines.exit()
      .transition().duration(200)
      .attr('opacity', 0)
      .remove();

    const entered = lines.enter().append('path')
      .attr('class', 'ts-line')
      .attr('fill', 'none')
      .attr('opacity', 0)
      .attr('stroke', d => _tsColor(d.country))
      .attr('d', d => lineGen(d.points));

    const merged = entered.merge(lines)
      .attr('stroke', d => _tsColor(d.country))
      .on('mouseover', hoverHandlers.mouseover)
      .on('mousemove', hoverHandlers.mousemove)
      .on('mouseout',  hoverHandlers.mouseout);

    merged.transition().duration(400)
      .attr('opacity', multi ? 0.85 : 1)
      .attr('d', d => lineGen(d.points));
  }

  function updateLegend(series, multi) {
    // Legend only helps when disambiguating ≥2 lines.
    const data = multi ? series : [];

    const items = _legend.selectAll('.legend-item')
      .data(data, d => d.country);

    items.exit().remove();

    const enter = items.enter().append('div')
      .attr('class', 'legend-item');
    enter.append('div').attr('class', 'legend-swatch');
    enter.append('span').attr('class', 'legend-label');

    const merged = enter.merge(items)
      .on('mouseover', hoverHandlers.mouseover)
      .on('mousemove', hoverHandlers.mousemove)
      .on('mouseout',  hoverHandlers.mouseout);

    merged.select('.legend-swatch')
      .style('background', d => _tsColor(d.country));
    merged.select('.legend-label')
      .text(d => d.country);

    // Hint only when >2 lines — at 1–2 lines the legend is self-explanatory.
    const hintData = series.length > 2 ? ['Hover a legend entry to highlight its line'] : [];
    _legendHint.selectAll('p').data(hintData)
      .join('p')
      .text(d => d);
  }

  function updateYearLine(year) {
    if (year == null) { _yearLine.attr('display', 'none'); return; }
    const xPos = xScale(year);
    _yearLine
      .attr('display', null)
      .transition().duration(300)
      .attr('x1', xPos).attr('x2', xPos)
      .attr('y1', 0).attr('y2', innerH);
  }

  // ── Main update orchestrator ─────────────────────────────────────────
  function update() {
    const indicator = State.getIndicator();
    const brushed   = State.getBrushed();
    const selected  = State.getSelected();
    const year      = State.getYear();

    _yLabel.text(indicator || '');

    const countries = brushed.length ? brushed : (selected ? [selected] : []);
    if (!indicator || !countries.length) {
      clearPlot(!indicator
        ? 'Select an indicator from the map panel'
        : 'Brush on PCA or click a country');
      return;
    }

    const series = countries
      .map(c => seriesFor(c, indicator))
      .filter(s => s && s.points.some(p => p.value != null));

    if (!series.length) {
      clearPlot('No data for this indicator');
      return;
    }

    _hintText.style('display', 'none');
    _pointsByCountry.clear();
    for (const s of series) _pointsByCountry.set(s.country, s.points);

    d3.select('#ts-country').text(
      series.length === 1 ? `— ${series[0].country}` : `— ${series.length} countries`
    );

    const allPoints   = series.flatMap(s => s.points);
    const definedVals = allPoints.filter(p => p.value != null);
    xScale.domain(d3.extent(allPoints,   p => p.year));
    yScale.domain(d3.extent(definedVals, p => p.value)).nice();
    _xAxisG.call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(6));
    _yAxisG.call(d3.axisLeft(yScale).ticks(5));

    const multi = series.length > 1;
    updateLines(series, multi);
    updateLegend(series, multi);
    updateYearLine(year);
  }

  // ── One-time scaffold ────────────────────────────────────────────────
  function render(timeseries) {
    _timeseries = timeseries;

    const names = Object.keys(timeseries).sort();
    _tsColor.domain(names).range(d3.quantize(d3.interpolateRainbow, names.length));

    const svg = d3.select('#ts-container')
      .append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    _xAxisG = g.append('g').attr('class', 'axis')
      .attr('transform', `translate(0,${innerH})`);
    _yAxisG = g.append('g').attr('class', 'axis');

    g.append('text').attr('class', 'axis-label')
      .attr('x', innerW / 2).attr('y', innerH + 42)
      .attr('text-anchor', 'middle')
      .text('Year');

    _yLabel = g.append('text').attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -58)
      .attr('text-anchor', 'middle')
      .text('');

    _hintText = g.append('text')
      .attr('class', 'ts-hint')
      .attr('x', innerW / 2).attr('y', innerH / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text('Brush on PCA or click a country');

    _lineGroup = g.append('g').attr('class', 'ts-lines');

    _yearLine = g.append('line')
      .attr('class', 'ts-year-line')
      .attr('display', 'none');

    // Hint lives between the chart and the legend; content is managed by a
    // d3 data-join in updateLegend so it appears only for >2 lines.
    _legendHint = d3.select('#ts-panel').insert('div', '#ts-legend')
      .attr('class', 'ts-legend-hint');
    _legend = d3.select('#ts-legend');

    State.on('change',    update);
    State.on('brush',     update);
    State.on('indicator', update);
    State.on('year',      update);
  }

  return { render, update };
})();
