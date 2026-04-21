/**
 * state.js — Shared application state for coordinated views.
 * Subscribe via State.on('change', cb) or State.on('hover', cb).
 */
const State = (() => {
  let _selected = null;
  let _hovered  = null;
  const _listeners = [];

  function on(event, fn) {
    _listeners.push({ event, fn });
  }

  function emit(event, data) {
    _listeners
      .filter(l => l.event === event)
      .forEach(l => l.fn(data));
  }

  function select(country) {
    _selected = (_selected === country) ? null : country;  // toggle
    emit('change', { selected: _selected });
  }

  function hover(country) {
    _hovered = country ?? null;
    emit('hover', { hovered: _hovered });
  }

  function getSelected() { return _selected; }
  function getHovered()  { return _hovered; }

  return { on, select, hover, getSelected, getHovered };
})();
