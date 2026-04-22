from flask import Flask, render_template
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import json

app = Flask(__name__)


def load_regions():
    with open('static/data/regions.json') as f:
        return json.load(f)


# Load once at startup; used for both COUNTRIES and the per-request region map.
_REGIONS = load_regions()
COUNTRIES = list(_REGIONS.keys())


def load_and_filter_data():
    clean_data = pd.read_csv("static/data/clean_data.csv")
    df = clean_data[clean_data['Country Name'].isin(COUNTRIES)]
    return df


def compute_pca(df):
    most_recent_year = df['year'].max()
    df_recent = df[df['year'] == most_recent_year].copy()
    # Exclude 'year': it's constant in this subset and not a meaningful feature.
    feature_cols = [c for c in df_recent.select_dtypes(include=[np.number]).columns if c != 'year']
    df_recent = df_recent.dropna(subset=feature_cols)

    X = df_recent[feature_cols].values
    countries = df_recent['Country Name'].tolist()
    X_scaled = StandardScaler().fit_transform(X)

    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X_scaled)

    return {
        'year': int(most_recent_year),
        'countries': countries,
        'pca_coords': X_pca.tolist(),
        'explained_variance': pca.explained_variance_ratio_.tolist(),
        'feature_names': feature_cols,
    }


def build_country_ids(df):
    # Maps country name to padded ISO numeric string ("008") matching world-atlas topology IDs.
    with open('static/data/iso_numeric.json') as f:
        iso_alpha3_to_numeric = json.load(f)
    name_to_code = df[['Country Name', 'Country Code']].drop_duplicates().set_index('Country Name')['Country Code'].to_dict()
    return {name: iso_alpha3_to_numeric[code] for name, code in name_to_code.items() if code in iso_alpha3_to_numeric}


@app.route('/')
def index():
    df = load_and_filter_data()
    pca_data = compute_pca(df)

    # Exclude identifier columns so the indicator dropdown only shows numeric features.
    feature_cols = [c for c in df.columns if c not in ['Country Name', 'Country Code', 'year']]
    timeseries = {}
    for country in COUNTRIES:
        cdf = df[df['Country Name'] == country].sort_values('year')
        timeseries[country] = {
            'years': cdf['year'].tolist(),
            **{col: cdf[col].round(2).tolist() for col in feature_cols if col in cdf.columns}
        }

    country_ids = build_country_ids(df)

    year_range = {
        'min':     int(df['year'].min()),
        'max':     int(df['year'].max()),
        'initial': int(df['year'].max()),
    }

    return render_template(
        'index.html',
        countries=COUNTRIES,
        pca_data=pca_data,
        timeseries=timeseries,
        features=feature_cols,
        country_ids=country_ids,
        country_regions=_REGIONS,
        year_range=year_range,
    )


def main():
    app.run(debug=True, port=5000)


if __name__ == '__main__':
    main()
