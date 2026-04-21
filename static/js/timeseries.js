/**
 * timeseries.js — Task 5/6: coordinated time-series line chart.
 *
 * Data is driven by shared State:
 *   • brushed (PCA brush) non-empty → one line per brushed country
 *   • otherwise selected               → single line
 *   • otherwise                        → placeholder hint
 *
 * A vertical reference line marks State.year. It is a single <line> element
 * whose x1/x2 transition on year change — never re-appended.
 *
 * Chart container (axes, labels, hint, line group, year line) is built once;
 * updates use keyed data-joins on .ts-line (keyed by country name).
 */

const TimeSeriesChart = (() => {
  const margin = { top: 20, right: 20, bottom: 50, left: 65 };
  const W = 500, H = 300;
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top  - margin.bottom;

  let _timeseries = null;
  let _xAxisG, _yAxisG, _hintText, _lineGroup, _yearLine, _yLabel;

  const xScale = d3.scaleLinear().range([0, innerW]);
  const yScale = d3.scaleLinear().range([innerH, 0]);

  const lineGen = d3.line()
    .defined(d => d.value != null)
    .x(d => xScale(d.year))
    .y(d => yScale(d.value));

  function seriesFor(country, indicator) {
    const ts = _timeseries[country];
    if (!ts) return null;
    const vals = ts[indicator];
    if (!vals) return null;
    const points = ts.years.map((yr, i) => ({ year: yr, value: vals[i] ?? null }));
    return { country, points };
  }

  function update() {
    const indicator = State.getIndicator();
    const brushed   = State.getBrushed();
    const selected  = State.getSelected();
    const year      = State.getYear();

    _yLabel.text(indicator || '');

    // Decide which countries to plot.
    const countries = brushed.length ? brushed : (selected ? [selected] : []);

    if (!indicator || !countries.length) {
      _lineGroup.selectAll('.ts-line').remove();
      _yearLine.attr('display', 'none');
      _hintText.style('display', null)
        .text(!indicator
          ? 'Select an indicator from the map panel'
          : 'Brush on PCA or click a country');
      d3.select('#ts-country').text('');
      return;
    }

    // Build series + compute y-extent across *all* plotted countries.
    const series = countries.map(c => seriesFor(c, indicator)).filter(s => s && s.points.some(p => p.value != null));

    if (!series.length) {
      _lineGroup.selectAll('.ts-line').remove();
      _yearLine.attr('display', 'none');
      _hintText.style('display', null).text('No data for this indicator');
      d3.select('#ts-country').text('');
      return;
    }

    _hintText.style('display', 'none');
    d3.select('#ts-country').text(
      series.length === 1 ? `— ${series[0].country}` : `— ${series.length} countries`
    );

    const allPoints  = series.flatMap(s => s.points);
    const definedVals = allPoints.filter(p => p.value != null);
    xScale.domain(d3.extent(allPoints, p => p.year));
    yScale.domain(d3.extent(definedVals, p => p.value)).nice();

    _xAxisG.call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(6));
    _yAxisG.call(d3.axisLeft(yScale).ticks(5));

    // Keyed join — enter/update/exit per country line.
    const lines = _lineGroup.selectAll('.ts-line')
      .data(series, d => d.country);

    lines.exit()
      .transition().duration(200)
      .attr('opacity', 0)
      .remove();

    const entered = lines.enter().append('path')
      .attr('class', 'ts-line')
      .attr('fill', 'none')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0)
      .attr('stroke', d => PCAChart.countryColor(d.country))
      .attr('d', d => lineGen(d.points));

    entered.merge(lines)
      .attr('stroke', d => PCAChart.countryColor(d.country))
      .transition().duration(400)
      .attr('opacity', series.length === 1 ? 1 : 0.85)
      .attr('d', d => lineGen(d.points));

    // Year reference line — single element, updated via attrs.
    if (year != null) {
      const xPos = xScale(year);
      _yearLine
        .attr('display', null)
        .transition().duration(300)
        .attr('x1', xPos).attr('x2', xPos)
        .attr('y1', 0).attr('y2', innerH);
    } else {
      _yearLine.attr('display', 'none');
    }
  }

  function render(timeseries) {
    _timeseries = timeseries;

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

    // Year reference line — created once, reused forever.
    _yearLine = g.append('line')
      .attr('class', 'ts-year-line')
      .attr('display', 'none');

    // State subscriptions — any relevant change triggers a unified update.
    State.on('change',    update);
    State.on('brush',     update);
    State.on('indicator', update);
    State.on('year',      update);
  }

  return { render, update };
})();
