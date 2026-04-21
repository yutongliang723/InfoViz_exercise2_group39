from flask import Flask, render_template, jsonify
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import json
import os

app = Flask(__name__)

COUNTRIES = [
    'Afghanistan', 'Albania', 'Algeria', 'Angola', 'Argentina', 'Armenia',
    'Australia', 'Austria', 'Azerbaijan', 'Brazil', 'Bulgaria', 'Cameroon',
    'Chile', 'China', 'Colombia', 'Croatia', 'Cuba', 'Cyprus',
    'Czech Republic', 'Ecuador', 'Egypt, Arab Rep.', 'Eritrea', 'Ethiopia',
    'France', 'Germany', 'Ghana', 'Greece', 'India', 'Indonesia',
    'Iran, Islamic Rep.', 'Iraq', 'Ireland', 'Italy', 'Japan', 'Jordan',
    'Kazakhstan', 'Kenya', 'Lebanon', 'Malta', 'Mexico', 'Morocco',
    'Pakistan', 'Peru', 'Philippines', 'Russian Federation',
    'Syrian Arab Republic', 'Tunisia', 'Turkey', 'Ukraine'
]


def load_and_filter_data():
    clean_data = pd.read_csv("static/data/clean_data.csv")
    df = clean_data[clean_data['Country Name'].isin(COUNTRIES)] # filter to only the specified countries
    return df


def compute_pca(df): # task 2: compute pca on the most recent year's data
    
    most_recent_year = df['year'].max() # get the most recent year
    df_recent = df[df['year'] == most_recent_year].copy()
    feature_cols = df_recent.select_dtypes(include=[np.number]).columns.tolist() # get numeric feature columns
    df_recent = df_recent.dropna(subset=feature_cols) # drop missing values

    # sxtract feature matrix
    X = df_recent[feature_cols].values
    countries = df_recent['Country Name'].tolist()
    scaler = StandardScaler() # scale features 
    X_scaled = scaler.fit_transform(X)

    pca = PCA(n_components=2) # apply PCA to 2 components
    X_pca = pca.fit_transform(X_scaled)

    explained_variance = pca.explained_variance_ratio_.tolist() # for axis labels
    loadings = pca.components_.tolist() # loadings for optional biplot

    result = {
        'year': int(most_recent_year),
        'countries': countries,
        'pca_coords': X_pca.tolist(),
        'explained_variance': explained_variance,
        'feature_names': feature_cols,
        'loadings': loadings,
    }
    return result


@app.route('/')
def index():
    df = load_and_filter_data() # task 1: load and filter data
    pca_data = compute_pca(df) # task 2 compute PCA

    # prepare time-series data for all countries and years
    # exclude non-numeric identifier columns so the indicator dropdown only
    # offers plottable features (Country Code is a string like "ALB").
    feature_cols = [c for c in df.columns if c not in ['Country Name', 'Country Code', 'year']]
    timeseries = {}
    for country in COUNTRIES:
        cdf = df[df['Country Name'] == country].sort_values('year')
        timeseries[country] = {
                                'years': cdf['year'].tolist(),
                                **{col: cdf[col].round(2).tolist() for col in feature_cols if col in cdf.columns}
                            }

    return render_template(
                            'index.html',
                            countries=COUNTRIES,   
                            pca_data=pca_data, 
                            timeseries=timeseries, 
                            features=feature_cols,
                        )

@app.route('/api/data')
def api_data():
    df = load_and_filter_data()
    return jsonify(df.to_dict(orient='records'))


@app.route('/api/pca')
def api_pca():
    df = load_and_filter_data()
    return jsonify(compute_pca(df))


def main():
    app.run(debug=True, port=5000)


if __name__ == '__main__':
    main()
