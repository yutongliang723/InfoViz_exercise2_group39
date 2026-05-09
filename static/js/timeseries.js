const TimeSeriesChart = (() => {
  const margin = { top: 20, right: 10, bottom: 50, left: 85 };
  const W = 900;
  const H = 400;
  const innerW = W - margin.left - margin.right - 100;
  const innerH = H - margin.top - margin.bottom;

  const xScale = d3.scaleLinear().range([0, innerW]);
  const yScale = d3.scaleLinear().range([innerH, 0]);

  const lineGen = d3.line()
    .defined(d => d.value != null)
    .x(d => xScale(d.year))
    .y(d => yScale(d.value));

  // Per-country colors independent of region; rainbow gives distinct hues for any subset.
  const _tsColor = d3.scaleOrdinal();

  let _timeseries = null;
  let _xAxisG, _yAxisG, _hintText, _lineGroup, _yearLine, _yLabel, _legendG;
  let _globalYearDomain = null;

  const _pointsByCountry = new Map();

  const tooltip = d3.select('#tooltip');

  const fmtAxis = d3.format('~s');
  const fmtTooltip = d3.format(',.2f');

  function seriesFor(country, indicator) {
    const ts = _timeseries[country];
    if (!ts) return null;
    const vals = ts[indicator];
    if (!vals) return null;
    const points = ts.years.map((yr, i) => ({ year: yr, value: vals[i] ?? null }));
    return { country, points };
  }

  function highlight(country) {
    _lineGroup.selectAll('.ts-line')
      .classed('faded', d => country && d.country !== country)
      .classed('highlighted', d => d.country === country);

  }

  function showTip(event, country) {
    const points = _pointsByCountry.get(country);
    const yr = State.getYear();
    const atYear = points?.find(p => p.year === yr);
    const valTxt = atYear?.value != null ? fmtTooltip(atYear.value) : '—';
    tooltip.classed('hidden', false)
      .html(`<strong>${country}</strong><br>${yr ?? ''}: ${valTxt}`)
      .style('left', (event.clientX + 14) + 'px')
      .style('top', (event.clientY - 10) + 'px');
  }
  function hideTip() { tooltip.classed('hidden', true); }

  const hoverHandlers = {
    mouseover: (event, d) => { highlight(d.country); showTip(event, d.country); },
    mousemove: (event, d) => showTip(event, d.country),
    mouseout: () => { highlight(null); hideTip(); },
  };

  function clearPlot(hintMessage) {
    _lineGroup.selectAll('.ts-line').remove();
    _legendG.selectAll('.legend-item').remove();
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
      .on('mouseout', hoverHandlers.mouseout);

    merged.transition().duration(400)
      .attr('opacity', multi ? 0.85 : 1)
      .attr('d', d => lineGen(d.points));
  }

  function updateLegend(series) {
    const items = _legendG.selectAll('.legend-item')
      .data(series, d => d.country);

    items.exit().remove();

    const enter = items.enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 20})`)
      .style('cursor', 'pointer');

    enter.append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('y', -8);

    enter.append('text')
      .attr('x', 16)
      .attr('y', 0)
      .attr('alignment-baseline', 'middle')
      .style('font-size', '16px');

    const merged = enter.merge(items)
      .on('mouseover', hoverHandlers.mouseover)
      .on('mousemove', hoverHandlers.mousemove)
      .on('mouseout', hoverHandlers.mouseout);

    merged.select('rect')
      .attr('fill', d => _tsColor(d.country));

    merged.select('text')
      .text(d => d.country);

    merged.transition()
      .attr('transform', (d, i) => `translate(0, ${i * 20})`);
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

  function update() {
    const indicator = State.getIndicator();
    const brushed = State.getBrushed();
    const selected = State.getSelected();
    const year = State.getYear();

    _yLabel.text(indicator || '');

    const countries =
      brushed.length
        ? brushed
        : (selected && selected.length ? selected : []);
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
      series.length === 1
        ? `: ${series[0].country}`
        : `— ${series.map(d => d.country).join(', ')}`
    );

    const allPoints = series.flatMap(s => s.points);
    const definedVals = allPoints.filter(p => p.value != null);

    if (_globalYearDomain) xScale.domain(_globalYearDomain);

    const [minV, maxV] = d3.extent(definedVals, p => p.value);
    const range = maxV - minV || 1;
    const pad = range * 0.1;
    yScale.domain([minV - pad, maxV + pad]).nice();
    _xAxisG.call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(6));
    _xAxisG.selectAll('text').style('font-size', '16px'); 
    _yAxisG.call(d3.axisLeft(yScale).ticks(5).tickFormat(fmtAxis));
    _yAxisG.selectAll('text').style('font-size', '16px');

    const multi = series.length > 1;
    updateLines(series, multi);
    updateLegend(series);
    updateYearLine(year);
  }

  function render(timeseries) {
    _timeseries = timeseries;

    const allYears = Object.values(timeseries).flatMap(ts => ts.years ?? []);
    const [minYear, maxYear] = d3.extent(allYears);
    _globalYearDomain = (minYear != null && maxYear != null)
      ? [minYear - 1, maxYear + 1]
      : null;

    const names = Object.keys(timeseries).sort();
    _tsColor.domain(names).range(d3.quantize(d3.interpolateRainbow, names.length));

    const svg = d3.select('#ts-container')
      .append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      // .attr('width', '100%');
      // .attr('width', W)
      .style('max-width', '100%')

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    _xAxisG = g.append('g').attr('class', 'axis')
      .attr('transform', `translate(0,${innerH})`)
      .style('font-size', '16px'); 
    _yAxisG = g.append('g').attr('class', 'axis')
      .style('font-size', '16px'); 
    

    g.append('text').attr('class', 'axis-label')
      .attr('x', innerW / 2).attr('y', innerH + 42)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .text('Year');

    _yLabel = g.append('text').attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -58)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .text('');

    _hintText = g.append('text')
      .attr('class', 'ts-hint')
      .attr('x', innerW / 2).attr('y', innerH / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text('Brush on PCA or click a country')
      .style('font-size', '18px');

    _lineGroup = g.append('g').attr('class', 'ts-lines');

    _yearLine = g.append('line')
      .attr('class', 'ts-year-line')
      .attr('display', 'none');

    _legendG = g.append('g')
      .attr('class', 'ts-legend')
      .attr('transform', `translate(${innerW + 30}, 20)`);

    State.on('change', update);
    State.on('brush', update);
    State.on('indicator', update);
    State.on('year', update);
  }

  return { render };
})();
