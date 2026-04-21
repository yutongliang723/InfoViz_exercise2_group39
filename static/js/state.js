/**
 * state.js — Shared application state for coordinated views.
 *
 * Events:
 *   'change'    — { selected }   — single-country selection (toggles)
 *   'brush'     — { brushed }    — array of countries from the PCA brush
 *   'hover'     — { hovered }    — transient hover target (PCA or map)
 *   'year'      — { year }       — slider year (int)
 *   'indicator' — { indicator }  — current #indicator-select value ('' = none)
 *
 * Subscribers register via State.on(event, cb). Setters always emit, even if
 * the value didn't change — keeps it simple and lets subscribers decide.
 */
const State = (() => {
  let _selected  = null;
  let _brushed   = [];
  let _hovered   = null;
  let _year      = null;
  let _indicator = '';
  const _listeners = [];

  function on(event, fn) { _listeners.push({ event, fn }); }
  function emit(event, data) {
    _listeners.filter(l => l.event === event).forEach(l => l.fn(data));
  }

  function select(country) {
    _selected = (_selected === country) ? null : country;   // toggle
    emit('change', { selected: _selected });
  }

  function hover(country) {
    _hovered = country ?? null;
    emit('hover', { hovered: _hovered });
  }

  function setBrushed(list) {
    _brushed = Array.isArray(list) ? list : [];
    emit('brush', { brushed: _brushed });
  }

  function setYear(year) {
    _year = (year == null) ? null : +year;
    emit('year', { year: _year });
  }

  function setIndicator(indicator) {
    _indicator = indicator || '';
    emit('indicator', { indicator: _indicator });
  }

  return {
    on, select, hover, setBrushed, setYear, setIndicator,
    getSelected:  () => _selected,
    getBrushed:   () => _brushed,
    getHovered:   () => _hovered,
    getYear:      () => _year,
    getIndicator: () => _indicator,
  };
})();
