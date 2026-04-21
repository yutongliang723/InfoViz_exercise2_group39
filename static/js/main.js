(async function main() {

  // parse data injected by Jinja2 via <script type="application/json">
  const serverData = JSON.parse(document.getElementById('server-data').textContent);
  const COUNTRIES = serverData.countries;
  const PCA_DATA = serverData.pca_data;
  const TIMESERIES = serverData.timeseries;
  const FEATURES = serverData.features;

  // PCA scatterplot
  PCAChart.render(PCA_DATA);

  // task 4: choropleth map
  await MapChart.render({ countries: COUNTRIES, timeseries: TIMESERIES, features: FEATURES });

  // task 5: time-series panel
  TimeSeriesChart.render(TIMESERIES, FEATURES);

  console.log('[Exercise 2] All views initialised.');
  console.log(`PCA year: ${PCA_DATA.year}, countries: ${PCA_DATA.countries.length}`);
  console.log(`Explained variance — PC1: ${(PCA_DATA.explained_variance[0] * 100).toFixed(1)}%, PC2: ${(PCA_DATA.explained_variance[1] * 100).toFixed(1)}%`);

})();