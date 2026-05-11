# Information Visualization - Exercise 2 (Group 39)

Flask web app with coordinated views (PCA scatterplot, choropleth map, time series) over world development indicators.

## Prerequisites

- Python 3.13+

## Quick Start

### Option A: Using `uv`

[`uv`](https://docs.astral.sh/uv/) will download Python 3.13 and install the dependencies for you.

```bash
# Install uv (if you don't have it)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run the app
uv run python app.py
```

Open [http://localhost:5000](http://localhost:5000).

### Option B: Using `pip`

```bash
# Create a virtual environment
python3 -m venv .venv

# Activate it
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Run the app
python app.py
```

Open [http://localhost:5000](http://localhost:5000).

## Project Structure

```
├── app.py              # Flask application (routes, PCA computation)
├── pyproject.toml      # Project metadata & dependencies (for uv)
├── requirements.txt    # Dependencies (for pip)
├── templates/
│   └── index.html      # Main page template
└── static/
    ├── data/           # CSV datasets
    ├── js/             # JavaScript visualizations
    └── styles/         # CSS stylesheets
```
