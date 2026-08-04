# **Pokémon GO Unified API: Implementation Plan (v2)**

## **1\. Core Architecture: Static API & Automated Pipeline**

This project will use a "Git as a Database" model, relying on automated scripts to compile data from various sources into static files hosted on GitHub Pages. This ensures 100% forkability, complete historical tracking, and zero hosting costs.

## **2\. Community Submissions (The "No-Code" Flow)**

To allow regular players to submit data without knowing Git or JSON, we will use **GitHub Issue Forms** integrated into the frontend website.

* **The User Experience:** On the API's website, a user clicks "Submit Correction." They fill out a standard web form (e.g., selecting a Pokémon and checking a "Shiny Released" box).  
* **The Backend (Staging Table):** Submitting the form silently opens a structured GitHub Issue containing a YAML payload.  
* **The Ingestion:** Our nightly GitHub Action parses all open "Data Submission" issues. It treats these issues as an unparsed\_submissions table. Maintainers can simply click "Approve" on an issue, and the pipeline will automatically apply it as an override in the next build.

## **3\. The Data Ingestion Pipeline (The "Builder")**

The core backend script (Python or Node.js) runs nightly via GitHub Actions.

### **Phase 3.1: Source Definition, Fetching & Licensing**

We define a config file (sources.yml) that lists data origins, priorities, and **licenses**.

\# config/sources.yml  
alexelgt\_game\_masters:  
  repo: "alexelgt/game\_masters"  
  license: "MIT" \# Example  
  priority\_tier: 1  
pokeapi:  
  repo: "PokeAPI/pokeapi"  
  license: "BSD-3-Clause"  
  priority\_tier: 3

### **Phase 3.2: Raw Data Discovery & Normalization**

*Because Pokémon GO data is highly irregular across sources, we cannot define a strict schema until we look at the raw data.*

* **Step 1:** The script pulls all raw data into an exploration/raw\_dumps/ folder.  
* **Step 2:** The script normalizes IDs (e.g., standardizing MEWTWO\_A and mewtwo-armored to 150-armored).  
* **Step 3:** The script applies conflict resolution based on sources.yml and approved Community Submissions.

### **Phase 3.3: Provenance Metadata**

Every piece of data will track its origin and license to maintain open-source compliance and traceability.

{  
  "id": "150-armored",  
  "name": "Mewtwo (Armored)",  
  "\_metadata": {  
    "last\_updated": "2026-07-29T00:00:00Z",  
    "sources": {  
      "base\_stats": "alexelgt\_game\_masters@commit",  
      "pokedex\_entry": "pokeapi@commit"  
    },  
    "licenses": \["MIT", "BSD-3-Clause"\]  
  }  
}

## **4\. Output Generation & Exports**

To serve both web explorers and mobile app developers, the pipeline will generate data in three formats:

1. **REST-like Static Endpoints (JSON):** \* api/v1/pokemon/150.json (Great for web apps and lazy-loading).  
2. **The Massive JSON File:** \* api/v1/pogo-api-all.json. Contains every piece of data in one file.  
3. **The SQLite Database:** \* api/v1/pogo-api.sqlite. The pipeline will compile the JSON into a relational SQLite file, which app developers can download daily and ship directly inside their iOS/Android apps.

### **The Daily Manifest & Changelog**

Alongside the data dumps, the pipeline generates a manifest.json:

{  
  "schema\_version": "1.2.0",  
  "created\_at": "2026-07-29T08:00:00Z",  
  "changelog": {  
    "added": \["999-gimmighoul-roaming"\],  
    "updated": \[{"id": "1", "field": "is\_shiny\_released", "old": false, "new": true}\]  
  },  
  "downloads": {  
    "json\_bulk": "https://.../pogo-api-all.json",  
    "sqlite": "https://.../pogo-api.sqlite"  
  }  
}

## **5\. Execution Roadmap**

### **Step 1: Data Discovery & Raw Extraction (Current Focus)**

* Setup the base repository.  
* Write basic scripts to fetch the raw data from alexelgt, rplus, and PokeAPI.  
* Dump these into a temporary folder to visually inspect the structures, naming conventions, and conflicts.

### **Step 2: Schema Definition & Normalization Engine**

* Based on Step 1, define the official Unified API JSON Schema.  
* Write the normalization and conflict-resolution logic.

### **Step 3: Automation & Export Generation**

* Implement the SQLite and bulk JSON generators.  
* Create the GitHub Actions workflow to run this nightly, generate the Changelog, and publish to GitHub Pages.

### **Step 4: Community Frontend**

* Build the React frontend to browse the data.  
* Implement the GitHub Issue Form for easy, no-code community data submissions.
