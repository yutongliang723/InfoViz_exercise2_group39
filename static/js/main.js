(async function main() {

  const serverData = JSON.parse(document.getElementById('server-data').textContent);
  const COUNTRIES       = serverData.countries;
  const PCA_DATA        = serverData.pca_data;
  const TIMESERIES      = serverData.timeseries;
  const FEATURES        = serverData.features;
  const COUNTRY_IDS     = serverData.country_ids;
  const COUNTRY_REGIONS = serverData.country_regions;

  // Seed year before charts render so State.getYear() is non-null on first subscription.
  const slider    = document.getElementById('year-slider');
  const yearLabel = document.getElementById('year-label');
  State.setYear(+slider.value);
  yearLabel.textContent = slider.value;

  PCAChart.render(PCA_DATA, TIMESERIES, COUNTRY_REGIONS);
  await MapChart.render({
    countries:  COUNTRIES,
    timeseries: TIMESERIES,
    features:   FEATURES,
    countryIds: COUNTRY_IDS,
  });
  TimeSeriesChart.render(TIMESERIES);

  // Pre-select first indicator so every view has something to show on load.
  const indicatorSelect = document.getElementById('indicator-select');
  indicatorSelect.value = FEATURES[0];
  State.setIndicator(FEATURES[0]);

  slider.addEventListener('input', (e) => {
    yearLabel.textContent = e.target.value;
    State.setYear(+e.target.value);
  });

  d3.select('#indicator-select').on('change', (event) => {
    State.setIndicator(event.target.value);
  });

})();
