// Shared state singleton for coordinated views.
// Events: 'change' {selected}, 'brush' {brushed}, 'hover' {hovered},
//         'year' {year}, 'indicator' {indicator}
// Setters always emit even when the value is unchanged.
const State = (() => {
  // let _selected  = null;
  let _selected  = [] // array to allow multiple selections
  let _brushed   = [];
  let _hovered   = null;
  let _year      = null;
  let _indicator = '';
  const _listeners = [];

  function on(event, fn) { _listeners.push({ event, fn }); }
  function emit(event, data) {
    _listeners.filter(l => l.event === event).forEach(l => l.fn(data));
  }


  function select(country, multi = false) {
    if (!country) return;

    if (multi) {
      if (_selected.includes(country)) {
        _selected = _selected.filter(c => c !== country);
      } else {
        _selected = [..._selected, country];
      }
    } else {
      _selected = (_selected.length === 1 && _selected[0] === country)
        ? []                
        
        : [country];
    }

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
