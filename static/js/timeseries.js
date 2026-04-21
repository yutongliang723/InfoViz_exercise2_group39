/**
 * timeseries.js — Task 5: time-series line chart for a selected country.
 *
 * Subscribes to State 'change' to draw/clear the line.
 * Subscribes to #indicator-select 'change' to re-draw with the new indicator.
 * Uses enter/update on the path — the SVG is never rebuilt.
 */

const TimeSeriesChart = (() => {
  const margin = { top: 20, right: 20, bottom: 50, left: 65 };
  const W = 500, H = 300;
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top  - margin.bottom;

  // Module-level refs set during render(), used in update().
  let _timeseries = null;
  let _xAxisG, _yAxisG, _hintText, _lineGroup, _yLabel;

  const xScale = d3.scaleLinear().range([0, innerW]);
  const yScale = d3.scaleLinear().range([innerH, 0]);

  const lineGen = d3.line()
    .defined(d => d.value != null)
    .x(d => xScale(d.year))
    .y(d => yScale(d.value));

  function getIndicator() {
    return document.getElementById('indicator-select')?.value || '';
  }

  function getCountryData(country, indicator) {
    const ts = _timeseries[country];
    if (!ts) return [];
    const vals = ts[indicator] || [];
    return ts.years.map((yr, i) => ({ year: yr, value: vals[i] ?? null }));
  }

  function update(country) {
    const indicator = getIndicator();
    _yLabel.text(indicator);

    // Needs both an indicator AND a country to plot anything.
    if (!indicator || !country) {
      _lineGroup.selectAll('*').remove();
      _hintText.style('display', null)
        .text(!indicator
          ? 'Select an indicator from the map panel'
          : 'Click a country on the map');
      d3.select('#ts-country').text('');
      return;
    }

    _hintText.style('display', 'none');
    d3.select('#ts-country').text(`— ${country}`);

    const data = getCountryData(country, indicator);
    const defined = data.filter(d => d.value != null);
    if (!defined.length) {
      _lineGroup.selectAll('*').remove();
      return;
    }

    xScale.domain(d3.extent(data, d => d.year));
    yScale.domain(d3.extent(defined, d => d.value)).nice();

    _xAxisG.call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(6));
    _yAxisG.call(d3.axisLeft(yScale).ticks(5));

    _lineGroup.selectAll('.ts-line')
      .data([data])
      .join('path')
        .attr('class', 'ts-line')
        .transition().duration(400)
        .attr('d', lineGen);
  }

  function render(timeseries, features) {
    _timeseries = timeseries;

    const svg = d3.select('#ts-container')
      .append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    _xAxisG = g.append('g').attr('class', 'axis')
      .attr('transform', `translate(0,${innerH})`);
    _yAxisG = g.append('g').attr('class', 'axis');

    // Axis labels
    g.append('text').attr('class', 'axis-label')
      .attr('x', innerW / 2).attr('y', innerH + 42)
      .attr('text-anchor', 'middle')
      .text('Year');

    _yLabel = g.append('text').attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -58)
      .attr('text-anchor', 'middle')
      .text('');

    // "Click a country" placeholder
    _hintText = g.append('text')
      .attr('class', 'ts-hint')
      .attr('x', innerW / 2).attr('y', innerH / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text('Click a country on the map');

    _lineGroup = g.append('g');

    // React to country selection
    State.on('change', ({ selected }) => update(selected));

    // React to indicator changes (namespaced to avoid overwriting map.js handler)
    d3.select('#indicator-select').on('change.ts', () => update(State.getSelected()));
  }

  return { render, update };
})();
