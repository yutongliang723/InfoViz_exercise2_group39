(async function main() {

  // pull everything the server baked into the page
  const serverData = JSON.parse(document.getElementById('server-data').textContent);
  const COUNTRIES       = serverData.countries;
  const PCA_DATA        = serverData.pca_data;
  const TIMESERIES      = serverData.timeseries;
  const FEATURES        = serverData.features;
  const COUNTRY_IDS     = serverData.country_ids;
  const COUNTRY_REGIONS = serverData.country_regions;

  // set the year before anything renders — charts subscribe to State.getYear()
  // on init, so it needs to be non-null from the very start
  const slider    = document.getElementById('year-slider');
  const yearLabel = document.getElementById('year-label');
  State.setYear(+slider.value);
  yearLabel.textContent = slider.value;

  // render the three charts — map is async because it fetches the topojson
  PCAChart.render(PCA_DATA, TIMESERIES, COUNTRY_REGIONS);
  await MapChart.render({
    countries:  COUNTRIES,
    timeseries: TIMESERIES,
    features:   FEATURES,
    countryIds: COUNTRY_IDS,
  });
  TimeSeriesChart.render(TIMESERIES);

  // default to the first indicator so nothing looks empty on load
  const indicatorSelect = document.getElementById('indicator-select');
  indicatorSelect.value = FEATURES[0];
  State.setIndicator(FEATURES[0]);

  // wire up the year slider
  slider.addEventListener('input', (e) => {
    yearLabel.textContent = e.target.value;
    State.setYear(+e.target.value);
  });

  // wire up the indicator dropdown
  d3.select('#indicator-select').on('change', (event) => {
    State.setIndicator(event.target.value);
  });

})();