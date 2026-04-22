/**
 * main.js — bootstraps the three views and wires DOM controls → State.
 *
 * DOM ownership lives here so individual chart modules can stay pure
 * subscribers: indicator-select and year-slider emit via State, and all
 * charts react through State.on(...).
 */
(async function main() {

  const serverData = JSON.parse(document.getElementById('server-data').textContent);
  const COUNTRIES       = serverData.countries;
  const PCA_DATA        = serverData.pca_data;
  const TIMESERIES      = serverData.timeseries;
  const FEATURES        = serverData.features;
  const COUNTRY_IDS     = serverData.country_ids;
  const COUNTRY_REGIONS = serverData.country_regions;

  // Seed State from the year slider *before* charts render so initial
  // State.getYear() is non-null when each chart subscribes.
  const slider    = document.getElementById('year-slider');
  const yearLabel = document.getElementById('year-label');
  State.setYear(+slider.value);
  yearLabel.textContent = slider.value;

  // ── Chart render ─────────────────────────────────────────────────────
  PCAChart.render(PCA_DATA, TIMESERIES, COUNTRY_REGIONS);
  await MapChart.render({
    countries:  COUNTRIES,
    timeseries: TIMESERIES,
    features:   FEATURES,
    countryIds: COUNTRY_IDS,
  });
  TimeSeriesChart.render(TIMESERIES);

  // Pre-select the first indicator so every view has something to show on
  // load — otherwise the year slider appears broken until the user finds
  // the indicator dropdown.
  const indicatorSelect = document.getElementById('indicator-select');
  indicatorSelect.value = FEATURES[0];
  State.setIndicator(FEATURES[0]);

  // ── DOM → State wiring ───────────────────────────────────────────────
  slider.addEventListener('input', (e) => {
    yearLabel.textContent = e.target.value;
    State.setYear(+e.target.value);
  });

  d3.select('#indicator-select').on('change', (event) => {
    State.setIndicator(event.target.value);
  });

})();
