/**
 * state.js — Shared application state for coordinated views.
 * Any view that wants to react to selection changes subscribes
 * via State.on('change', callback).
 */
const State = (() => {
  let _selected = null;          // currently selected country (string | null)
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

  function getSelected() { return _selected; }

  return { on, select, getSelected };
})();
