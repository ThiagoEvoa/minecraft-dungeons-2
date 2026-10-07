# Item scraper setup

This guide covers setting up, running, and removing dependencies for `scrape_items.py`.

## Requirements

- Python 3
- Internet access

The scraper uses Beautiful Soup, listed in `requirements.txt`.

## Recommended: project virtual environment

Run commands from the project directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

`.venv/` lives inside the project directory and isolates its packages from other projects. Activate it again in each new terminal session before running the scraper:

```bash
source .venv/bin/activate
```

## Run scraper

With the virtual environment active:

```bash
python scrape_items.py
```

Writes `items.json` in the current directory. Choose another output path with:

```bash
python scrape_items.py --output data/items.json
```

The scraper fetches Gear and Talisman item pages, extracts descriptions and infobox details, and pauses 0.3 seconds between requests. Adjust the pause with `--delay`, for example `--delay 1`.

## Remove dependencies

If installed in `.venv`, deactivate and delete the environment:

```bash
deactivate
rm -rf .venv
```

This removes the environment and its packages, not your script or JSON output.

If you installed packages directly using `python3 -m pip install -r requirements.txt` without activating a virtual environment, they were installed in that Python environment, not project-locally. Remove Beautiful Soup there with:

```bash
python3 -m pip uninstall beautifulsoup4
```

Only uninstall it if no other projects use that same Python environment. To avoid affecting other projects, use a virtual environment instead.
