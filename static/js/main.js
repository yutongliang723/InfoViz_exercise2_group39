(async function main() {
 
  // parse data injected by Jinja2 via <script type="application/json">
  const serverData = JSON.parse(document.getElementById('server-data').textContent);
  const COUNTRIES   = serverData.countries;
  const PCA_DATA    = serverData.pca_data;
  const TIMESERIES  = serverData.timeseries;
  const FEATURES    = serverData.features;
 
  // taks 2: PCA scatterplot
  PCAChart.render(PCA_DATA);
 
  // // World map
  // await MapChart.render(COUNTRIES);
 
  // // Time-series panel
  // TimeSeriesChart.init(TIMESERIES, FEATURES);
 
  console.log('[Exercise 2] All views initialised.');
  console.log(`PCA year: ${PCA_DATA.year}, countries: ${PCA_DATA.countries.length}`);
  console.log(`Explained variance — PC1: ${(PCA_DATA.explained_variance[0]*100).toFixed(1)}%, PC2: ${(PCA_DATA.explained_variance[1]*100).toFixed(1)}%`);
 
})();