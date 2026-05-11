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


# load once at startup
_REGIONS = load_regions()
COUNTRIES = list(_REGIONS.keys())


def load_and_filter_data():
    clean_data = pd.read_csv("static/data/clean_data.csv")
    df = clean_data[clean_data['Name'].isin(COUNTRIES)]
    return df


def compute_pca(df):
    most_recent_year = df['Year'].max()
    df_recent = df[df['Year'] == most_recent_year].copy()
    # Year is constant in this subset, drop it from the feature set
    feature_cols = [c for c in df_recent.select_dtypes(include=[np.number]).columns if c != 'Year']
    df_recent = df_recent.dropna(subset=feature_cols)

    X = df_recent[feature_cols].values
    countries = df_recent['Name'].tolist()
    # scale before PCA so high-range features don't dominate
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
    # world-atlas topojson keys countries by padded numeric ISO (e.g. "008"), not name
    with open('static/data/iso_numeric.json') as f:
        iso_alpha3_to_numeric = json.load(f)
    name_to_code = df[['Name', 'Code']].drop_duplicates().set_index('Name')['Code'].to_dict()
    return {name: iso_alpha3_to_numeric[code] for name, code in name_to_code.items() if code in iso_alpha3_to_numeric}


@app.route('/')
def index():
    df = load_and_filter_data()
    pca_data = compute_pca(df)

    # only numeric indicator columns end up in the dropdown
    feature_cols = [c for c in df.columns if c not in ['Name', 'Code', 'Year']]
    timeseries = {}
    for country in COUNTRIES:
        cdf = df[df['Name'] == country].sort_values('Year')
        timeseries[country] = {
            'years': cdf['Year'].tolist(),
            **{col: cdf[col].round(2).tolist() for col in feature_cols if col in cdf.columns}
        }

    country_ids = build_country_ids(df)

    year_range = {
        'min':     int(df['Year'].min()),
        'max':     int(df['Year'].max()),
        'initial': int(df['Year'].max()),
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
